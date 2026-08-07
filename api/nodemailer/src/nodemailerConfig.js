import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

// Resend manda los mails vía API HTTPS en vez de SMTP. Lo usamos porque Render
// bloquea las conexiones SMTP salientes (probamos puerto 465 y 587, ambos con
// "Connection timeout"), algo común en hostings gratuitos.
export const resend = new Resend(process.env.RESEND_API_KEY);
