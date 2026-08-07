import { sendOrderConfirmationEmail } from "./orderConfirmation.js";
import dotenv from "dotenv";
dotenv.config();

export const successEvent = async (req, res) => {
    const return_Url = process.env.FRONTEND_URL || "https://bakeryapp-frontend.vercel.app";
    const isApproved = req.query && req.query.status === "approved" && req.query.payment_id;
    // Si el pago fue aprobado, le avisamos al frontend por query param para que vacíe el carrito
    const redirectUrl = isApproved ? `${return_Url}/?payment=success` : return_Url;

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
