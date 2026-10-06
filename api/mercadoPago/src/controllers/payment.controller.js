import crypto from "crypto";
import mercadopago from "mercadopago";
import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
import { DELIVERY_ZONES, getFrontendUrl } from "../../config.js";
import { armarCarrito, armarItems } from "../../pricing.js";
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

const selectProductById = db.prepare("SELECT id, title, price, image FROM products WHERE id = ?");
const insertOrder = db.prepare(`
  INSERT INTO orders (token, user_id, items, subtotal, discount, shipping, total,
                      delivery_type, delivery_zone, address, contact, contact_method)
  VALUES (@token, @userId, @items, @subtotal, @discount, @shipping, @total,
          @deliveryType, @deliveryZone, @address, @contact, @contactMethod)
`);
const deleteOrder = db.prepare("DELETE FROM orders WHERE token = ? AND status = 'pendiente_pago'");

const recortar = (value, max) => String(value ?? "").trim().slice(0, max);

export const createOrder = async (req, res) => {
  const { clientContact, contactMethod, deliveryType, address, deliveryZone } = req.body;

  // Precios, envío y descuento: ver pricing.js.
  const { cartList, error } = armarCarrito(req.body.cartList, (id) =>
    selectProductById.get(id)
  );
  if (error) {
    return res.status(400).json({ error });
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

  // Token al azar del link de seguimiento (ver orders/). Viaja a Mercado
  // Pago como "external_reference": así el webhook y /success saben qué
  // pedido de la base corresponde al pago.
  const orderToken = crypto.randomBytes(16).toString("hex");

  try {
    // Mercado Pago no garantiza devolver picture_url en additional_info.items
    // al consultar el pago después (es un campo pensado para su propio checkout,
    // no para que lo leamos nosotros de vuelta). Por eso las fotos
    // ("productImages") las guardamos nosotros en metadata, como el contacto.
    // Si pide delivery, el envío ya viene como un item más (salvo envío gratis).
    const { items, productImages, montos } = armarItems({
      cartList,
      conDescuento: tieneDescuento,
      deliveryType,
    });

    // El pedido se guarda antes de ir a Mercado Pago, como "pendiente_pago".
    // Pasa a "recibido" cuando se aprueba el pago (ver orderConfirmation.js).
    const esDelivery = deliveryType === "delivery";
    insertOrder.run({
      token: orderToken,
      userId: req.userId || null,
      items: JSON.stringify(
        cartList.map((product, i) => ({
          id: product.id,
          title: product.title,
          quantity: product.quantity,
          unit_price: items[i].unit_price,
          image: product.images?.[0] || "",
        }))
      ),
      subtotal: montos.subtotal,
      discount: montos.descuento,
      shipping: montos.envio,
      total: montos.total,
      deliveryType: esDelivery ? "delivery" : "takeaway",
      deliveryZone: esDelivery ? deliveryZone : "",
      address: esDelivery ? recortar(address, 200) : "",
      contact: recortar(clientContact, 80),
      contactMethod: contactMethod === "whatsapp" ? "whatsapp" : "instagram",
    });

    const frontendUrl = getFrontendUrl();
    const backendUrl = process.env.BACKEND_URL || "https://bakeryapp-backend-80a2.onrender.com";

    // Ids y cantidades de lo que se compró, para sumar ventas por producto
    // cuando el pago se apruebe (ver orderConfirmation.js): con eso se arma
    // el orden "Más vendidos" del catálogo y los destacados del Home. El
    // envío no se incluye (no es un producto).
    const productSales = cartList.map((product) => [product.id, product.quantity]);

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
        order_token: orderToken,
      },
      external_reference: orderToken,
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
      // Si Mercado Pago falló, el pedido nunca se va a poder pagar.
      deleteOrder.run(orderToken);
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
