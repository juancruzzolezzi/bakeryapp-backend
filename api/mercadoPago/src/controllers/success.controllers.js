import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
import dotenv from "dotenv";
dotenv.config();

export const successEvent = async (req, res) => {
    const return_Url = process.env.FRONTEND_URL || "https://bakeryapp-frontend.vercel.app";
    const isApproved = req.query && req.query.status === "approved" && req.query.payment_id;
    // Le avisamos al frontend por query param si fue aprobado (vacía el
    // carrito y muestra el mensaje de compra exitosa) o no (mensaje de
    // error, sin tocar el carrito).
    const redirectUrl = isApproved
      ? `${return_Url}/?payment=success`
      : `${return_Url}/?payment=failure`;

    // Intento de respaldo: manda el mail si el webhook todavía no llegó.
    // Si falla (credenciales, red, etc.) no debe impedir que el comprador
    // vuelva a la tienda.
    if (isApproved) {
      try {
        await sendOrderConfirmationEmail(req.query.payment_id);
        console.log("Correo enviado exitosamente (desde /success)");
      } catch (emailError) {
        console.error("No se pudo enviar el correo desde /success:", emailError.message);
      }
    }

    res.redirect(redirectUrl);
};
