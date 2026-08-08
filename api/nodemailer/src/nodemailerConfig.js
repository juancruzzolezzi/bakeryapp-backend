// Mailjet: alternativa a Resend/Brevo que no exige verificar un dominio propio
// (solo confirmar el mail remitente por link) y permite mandar a cualquier
// destinatario en el plan gratis. Usamos su API REST directo con fetch nativo
// de Node, sin agregar un SDK más.
export const MAILJET_API_URL = "https://api.mailjet.com/v3.1/send";
export const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
export const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
