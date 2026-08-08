// Brevo (ex-Sendinblue): a diferencia de Resend, su plan gratis (300 mails/día)
// no exige verificar un dominio propio para mandarle a cualquier destinatario,
// solo confirmar el mail remitente. Usamos su API REST directo con fetch nativo
// de Node, sin agregar un SDK más.
export const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
export const BREVO_API_KEY = process.env.BREVO_API_KEY;
