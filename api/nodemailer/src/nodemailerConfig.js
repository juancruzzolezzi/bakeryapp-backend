import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

// Resend manda los mails vía API HTTPS en vez de SMTP. Lo usamos porque Render
// bloquea las conexiones SMTP salientes (probamos puerto 465 y 587, ambos con
// "Connection timeout"), algo común en hostings gratuitos.
//
// Nota: en el plan gratis sin dominio verificado, Resend solo deja mandar al
// mail de la propia cuenta (no a terceros/compradores) — por eso el mail de
// confirmación al comprador está deshabilitado por ahora. Se probó migrar a
// Brevo (no exige dominio) pero la verificación de cuenta por SMS no llegaba;
// si en el futuro se resuelve eso o se verifica un dominio propio en Resend,
// se puede reactivar generateBuyerHtml en nodemailer.controllers.js.
export const resend = new Resend(process.env.RESEND_API_KEY);
