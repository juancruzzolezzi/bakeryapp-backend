import mercadopago from "mercadopago";
import { sendEmail } from "../../../nodemailer/src/controllers/nodemailer.controllers.js";
import { db } from "../../../db/db.js";
import { getFrontendUrl } from "../../config.js";
import { codigoPedido, esTokenValido } from "../../../orders/estados.js";

const insertRecordedPayment = db.prepare(
  "INSERT OR IGNORE INTO recorded_payments (payment_id) VALUES (?)"
);
const addSold = db.prepare("UPDATE products SET sold = sold + ? WHERE id = ?");
// Marca el pedido como pagado. Solo si seguía "pendiente_pago": si el
// webhook y /success llegan los dos, el segundo no cambia nada, y nunca
// pisa un estado que el local ya avanzó.
const markOrderPaid = db.prepare(`
  UPDATE orders SET status = 'recibido', payment_id = ?, paid_at = datetime('now')
  WHERE token = ? AND status = 'pendiente_pago'
`);
const selectOrderByToken = db.prepare("SELECT id, token FROM orders WHERE token = ?");
const selectNotified = db.prepare("SELECT 1 FROM notified_payments WHERE payment_id = ?");
const insertNotified = db.prepare(
  "INSERT OR IGNORE INTO notified_payments (payment_id) VALUES (?)"
);

// Suma las unidades vendidas de un pago aprobado (ver "product_sales" en
// payment.controller.js). En una transacción y registrando el paymentId:
// si el mismo pago llega dos veces (webhook + /success), la segunda no
// suma nada.
const recordSales = db.transaction((paymentId, productSales) => {
  const { changes } = insertRecordedPayment.run(String(paymentId));
  if (changes === 0) return;
  productSales.forEach(([productId, quantity]) => {
    if (Number.isInteger(quantity) && quantity > 0) addSold.run(quantity, productId);
  });
});

// Punto único de verdad: dado un paymentId, busca el pago en Mercado Pago y,
// si está aprobado, manda el mail de confirmación. Lo llaman tanto el webhook
// (la vía confiable, no depende del navegador del comprador) como el redirect
// de "success" (por si el webhook tarda o falla).
export const sendOrderConfirmationEmail = async (paymentId, { force = false } = {}) => {
  if (!paymentId) return { skipped: "no paymentId" };
  // Evita mandar el mail dos veces para el mismo pago (webhook + redirect de
  // "success" pueden llegar los dos, y Mercado Pago reintenta webhooks). Se
  // mira antes de consultar a Mercado Pago para no gastar esa llamada.
  if (!force && selectNotified.get(String(paymentId))) return { skipped: "ya notificado" };

  const payment = await mercadopago.payment.findById(paymentId);
  const body = payment?.body;

  if (!body || body.status !== "approved") {
    return { skipped: `status es '${body?.status}', no 'approved'` };
  }

  // Pedido de la base (ver payment.controller.js). Los pagos hechos antes
  // de que existiera la tabla de pedidos no traen token: siguen andando,
  // solo que sin link de seguimiento.
  const orderToken = esTokenValido(body.external_reference) ? body.external_reference : null;
  const order = orderToken ? selectOrderByToken.get(orderToken) : null;
  if (order) {
    markOrderPaid.run(String(paymentId), orderToken);
  }

  // Se marca recién acá, ya confirmado el pago: si webhook y /success llegan
  // a la vez, solo el primero que inserta sigue adelante.
  const { changes } = insertNotified.run(String(paymentId));
  if (!force && changes === 0) return { skipped: "ya notificado" };

  try {
    recordSales(paymentId, JSON.parse(body.metadata?.product_sales || "[]"));
  } catch (error) {
    // No sumar ventas no debe impedir que salga el mail del pedido.
    console.error("No se pudieron registrar las ventas del pago:", error.message);
  }

  // Las fotos las guardamos nosotros en metadata al crear la preferencia
  // (ver payment.controller.js) porque Mercado Pago no garantiza devolver
  // picture_url en additional_info.items.
  let productImages = [];
  try {
    productImages = JSON.parse(body.metadata?.product_images || "[]");
  } catch {
    productImages = [];
  }

  const products = (body.additional_info?.items || []).map((item, i) => ({
    title: item.title,
    unit_price: item.unit_price,
    quantity: item.quantity,
    picture_url: productImages[i] || "",
  }));

  const totalPay = body.transaction_amount;
  const clientEmail = body.payer?.email;
  const clientContact = body.metadata?.contact || "";
  const contactMethod = body.metadata?.contact_method || "";
  const deliveryType = body.metadata?.delivery_type || "";
  const deliveryZone = body.metadata?.delivery_zone || "";
  const address = [body.metadata?.address, deliveryZone].filter(Boolean).join(", ");

  const results = await sendEmail({
    orderCode: order ? codigoPedido(order.id) : "",
    trackingUrl: order ? `${getFrontendUrl()}/pedido/${order.token}` : "",
    panelUrl: `${getFrontendUrl()}/panel`,
    products,
    totalPay,
    clientEmail,
    clientContact,
    contactMethod,
    deliveryType,
    address,
  });
  return { results };
};
