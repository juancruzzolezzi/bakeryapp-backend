import mercadopago from "mercadopago";
import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
import { DELIVERY_ZONES, getFrontendUrl } from "../../config.js";
import { db } from "../../../db/db.js";
import dotenv from "dotenv";
dotenv.config();

// Se configura una sola vez al levantar el servidor (no adentro de cada request).
// Antes solo se configuraba dentro de /create-order: si Render arrancaba una
// instancia nueva y la primera petición que le llegaba era el webhook (en vez
// del checkout), el SDK no tenía credenciales cargadas y la búsqueda del pago
// para mandar el mail fallaba en silencio.
mercadopago.configure({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  access_token: process.env.ACCESS_TOKEN,
});

// Costo fijo de envío a domicilio. Se suma como un item más de la preferencia
// para que Mercado Pago cobre el total correcto (subtotal + envío).
const DELIVERY_FEE = 2000;

// A partir de este monto (sin contar el envío) el delivery sale gratis.
// Tiene que coincidir con FREE_SHIPPING_THRESHOLD en Cart.jsx y
// PaymentModal.jsx (ahí solo se le muestra al usuario, acá es donde se
// decide de verdad si se cobra o no).
const FREE_SHIPPING_THRESHOLD = 15000;

// 10% OFF en toda la tienda para cuentas registradas (ver auth/), en toda
// compra hecha con sesión iniciada. Tiene que coincidir con
// ACCOUNT_DISCOUNT_RATE en Cart.jsx/PaymentModal.jsx (ahí solo se le
// muestra al usuario, acá es donde se cobra el monto real con descuento).
const ACCOUNT_DISCOUNT_RATE = 0.1;

const selectProductById = db.prepare("SELECT id, title, price, image FROM products WHERE id = ?");

export const createOrder = async (req, res) => {
  const { clientContact, contactMethod, deliveryType, address, deliveryZone } = req.body;

  if (!Array.isArray(req.body.cartList) || req.body.cartList.length === 0) {
    return res.status(400).json({ error: "El carrito está vacío" });
  }

  // Título, precio y foto salen de la base, no de lo que manda el
  // navegador: si no, cualquiera podía editar el carrito guardado en
  // localStorage y pagar el precio que quisiera. Del carrito solo se usan
  // el id y la cantidad.
  const cartList = [];
  for (const item of req.body.cartList) {
    const product = selectProductById.get(item?.id);
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        error: "Hay un producto del carrito que ya no está disponible. Revisá tu pedido.",
      });
    }
    cartList.push({
      id: String(product.id),
      title: product.title,
      price: product.price,
      quantity,
      images: product.image ? [product.image] : [],
    });
  }

  // Cobertura de delivery: se valida acá (no solo en el modal de pago) para
  // que no se pueda cobrar un envío a una zona a la que no llegamos.
  if (deliveryType === "delivery" && !DELIVERY_ZONES.includes(deliveryZone)) {
    return res.status(400).json({
      error: "Todavía no hacemos delivery a esa zona. Podés elegir Take Away.",
    });
  }

  // "req.userId" lo pone optionalAuth (ver payment.routes.js) si vino un
  // token válido en el pedido: comprar sin cuenta sigue andando igual,
  // pero con sesión iniciada se aplica el descuento acá, no solo en la
  // pantalla (si no, cualquiera podría "verlo" descontado sin estar
  // registrado y pagar de menos).
  const tieneDescuento = Boolean(req.userId);

  try {
    const items = cartList.map((product) => ({
      title: product.title,
      currency_id: "ARS",
      unit_price: tieneDescuento
        ? Math.round(product.price * (1 - ACCOUNT_DISCOUNT_RATE))
        : product.price,
      quantity: product.quantity,
      picture_url: product.images?.[0] || "",
    }));

    const frontendUrl = getFrontendUrl();
    const backendUrl = process.env.BACKEND_URL || "https://bakeryapp-backend-80a2.onrender.com";

    // Mercado Pago no garantiza devolver picture_url en additional_info.items
    // al consultar el pago después (es un campo pensado para su propio checkout,
    // no para que lo leamos nosotros de vuelta). Guardamos las fotos nosotros
    // mismos en metadata, como ya hacemos con el contacto.
    const productImages = cartList.map((product) => product.images?.[0] || "");

    // Ids y cantidades de lo que se compró, para sumar ventas por producto
    // cuando el pago se apruebe (ver orderConfirmation.js): con eso se arma
    // el orden "Más vendidos" del catálogo y los destacados del Home. El
    // envío no se incluye (no es un producto).
    const productSales = cartList.map((product) => [product.id, product.quantity]);

    // Si pide delivery, se suma el costo de envío como un item más (así el
    // monto que cobra Mercado Pago ya incluye el envío, sin pasos manuales),
    // salvo que el subtotal ya llegue al mínimo para envío gratis.
    const subtotal = cartList.reduce(
      (sum, product) => sum + product.price * product.quantity,
      0
    );
    const envioGratis = subtotal >= FREE_SHIPPING_THRESHOLD;

    if (deliveryType === "delivery" && !envioGratis) {
      items.push({
        title: "Costo de envío",
        currency_id: "ARS",
        unit_price: DELIVERY_FEE,
        quantity: 1,
      });
      productImages.push("");
    }

    const preference = {
      items,
      metadata: {
        contact: clientContact || "",
        contact_method: contactMethod || "",
        delivery_type: deliveryType || "",
        address: deliveryType === "delivery" ? (address || "") : "",
        delivery_zone: deliveryType === "delivery" ? deliveryZone : "",
        product_sales: JSON.stringify(productSales),
        product_images: JSON.stringify(productImages),
        discount_applied: tieneDescuento ? "10%" : "",
      },
      back_urls: {
        success: `${backendUrl}/success`,
        // El carrito NO se toca acá (solo se vacía si el pago se aprueba,
        // ver /success): así, si el comprador vuelve sin haber pagado,
        // encuentra el carrito tal cual lo dejó.
        failure: `${frontendUrl}/products?payment=failure`,
        pending: `${frontendUrl}/products?payment=pending`,
      },
      notification_url: `${backendUrl}/webhook`,
      auto_return: "approved",
    };

    const result = await mercadopago.preferences.create(preference);

    res.status(200).json(result.body);
  } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
  }
};

export const recieveWebhook = async (req, res) => {
  const payment = req.body || {};
  console.log("Webhook recibido - query:", req.query, "body:", payment);

  try {
    // El webhook es la vía confiable para saber que un pago se aprobó: no depende
    // de que el comprador vuelva a la tienda con el navegador (a diferencia de /success).
    // Mercado Pago manda esta notificación en formatos distintos según el caso:
    // GET con "topic"/"id" (IPN clásico), GET/POST con "type"/"data.id" (webhooks nuevos).
    const notifType = payment.type || req.query.type || req.query.topic;
    const paymentId =
      payment?.data?.id || req.query["data.id"] || req.query.id;

    if (notifType === "payment" && paymentId) {
      await sendOrderConfirmationEmail(paymentId);
      console.log("Correo enviado exitosamente (desde webhook)");
    }

    res.status(200).send("webhook");
  } catch (error) {
    console.error("Webhook Error:", error.message);
    // Respondemos 200 igual: si devolvemos error, Mercado Pago reintenta el
    // webhook varias veces, y no queremos reintentos por una falla de mail.
    res.status(200).send("webhook");
  }
};
