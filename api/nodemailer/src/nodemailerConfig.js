import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  // Puerto 465 (SSL directo) da "Connection timeout" en Render: muchos hostings
  // gratuitos bloquean/filtran ese puerto. 587 con STARTTLS suele funcionar.
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Si Gmail no responde (red bloqueada, credenciales colgando la conexión, etc.)
  // preferimos que falle rápido con un error claro en vez de colgar el request.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

transporter
  .verify()
  .then(() => console.log("Email listening"))
  .catch((error) => console.log("error message: ", error));
