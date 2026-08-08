import mercadopago from "mercadopago";
import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
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

export const createOrder = async (req, res) => {
  const { cartList, clientContact, contactMethod } = req.body;

  console.log(req.body);


  try {
    const items = cartList.map((product) => ({
      title: product.title,
      currency_id: "ARS",
      unit_price: product.price,
      quantity: product.quantity,
      picture_url: product.images?.[0] || "",
    }));

    const frontendUrl = process.env.FRONTEND_URL || "https://bakeryapp-frontend.vercel.app";
    const backendUrl = process.env.BACKEND_URL || "https://bakeryapp-backend-80a2.onrender.com";

    // Mercado Pago no garantiza devolver picture_url en additional_info.items
    // al consultar el pago después (es un campo pensado para su propio checkout,
    // no para que lo leamos nosotros de vuelta). Guardamos las fotos nosotros
    // mismos en metadata, como ya hacemos con el contacto.
    const productImages = cartList.map((product) => product.images?.[0] || "");

    const preference = {
      items,
      metadata: {
        contact: clientContact || "",
        contact_method: contactMethod || "",
        product_images: JSON.stringify(productImages),
      },
      back_urls: {
        success: `${backendUrl}/success`,
        failure: `${frontendUrl}/`,
        pending: `${frontendUrl}/`,
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
