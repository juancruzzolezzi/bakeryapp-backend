import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
import { getFrontendUrl } from "../../config.js";
import dotenv from "dotenv";
dotenv.config();

export const successEvent = (req, res) => {
    const return_Url = getFrontendUrl();
    const isApproved = req.query && req.query.status === "approved" && req.query.payment_id;
    // Le avisamos al frontend por query param si fue aprobado (vacía el
    // carrito y muestra el mensaje de compra exitosa) o no (mensaje de
    // error, sin tocar el carrito).
    const redirectUrl = isApproved
      ? `${return_Url}/?payment=success`
      : `${return_Url}/?payment=failure`;

    // Primero se lo devuelve a la tienda: antes esperaba a que se consultara
    // el pago y salieran los dos mails, y el comprador veía unos segundos de
    // pantalla en blanco justo después de pagar.
    res.redirect(redirectUrl);

    // Intento de respaldo: manda el mail si el webhook todavía no llegó.
    // Si falla (credenciales, red, etc.) solo queda en el log.
    if (isApproved) {
      sendOrderConfirmationEmail(req.query.payment_id)
        .then(() => console.log("Correo enviado exitosamente (desde /success)"))
        .catch((emailError) =>
          console.error("No se pudo enviar el correo desde /success:", emailError.message)
        );
    }
};
