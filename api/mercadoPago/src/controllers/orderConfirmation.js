import mercadopago from "mercadopago";
import { sendEmail } from "../../../nodemailer/src/controllers/nodemailer.controllers.js";
import { db } from "../../../db/db.js";

const insertRecordedPayment = db.prepare(
  "INSERT OR IGNORE INTO recorded_payments (payment_id) VALUES (?)"
);
const addSold = db.prepare("UPDATE products SET sold = sold + ? WHERE id = ?");

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

// Evita mandar el mail dos veces para el mismo pago (webhook + redirect de "success"
// pueden dispararse ambos para el mismo pago). Se resetea si el servidor reinicia,
// lo cual está bien: preferimos un duplicado ocasional antes que perder el aviso.
const notifiedPaymentIds = new Set();

// Punto único de verdad: dado un paymentId, busca el pago en Mercado Pago y,
// si está aprobado, manda el mail de confirmación. Lo llaman tanto el webhook
// (la vía confiable, no depende del navegador del comprador) como el redirect
// de "success" (por si el webhook tarda o falla).
export const sendOrderConfirmationEmail = async (paymentId, { force = false } = {}) => {
  if (!paymentId) return { skipped: "no paymentId" };
  if (!force && notifiedPaymentIds.has(String(paymentId))) return { skipped: "ya notificado" };

  const payment = await mercadopago.payment.findById(paymentId);
  const body = payment?.body;

  if (!body || body.status !== "approved") {
    return { skipped: `status es '${body?.status}', no 'approved'` };
  }

  notifiedPaymentIds.add(String(paymentId));

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
