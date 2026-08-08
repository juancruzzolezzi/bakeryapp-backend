import { MAILJET_API_URL, MAILJET_API_KEY, MAILJET_SECRET_KEY } from "../../../nodemailer/src/nodemailerConfig.js";

// Endpoint TEMPORAL: manda un mail de prueba directo vía Mailjet y devuelve
// la respuesta CRUDA de la API (incluye el Message ID y el status real por
// destinatario), para poder buscarlo en el dashboard de Mailjet o confirmar
// el motivo exacto si algo falla.
export const debugMailjet = async (req, res) => {
  const to = req.query.to || process.env.EMAIL_USER;
  const sender = process.env.MAILJET_SENDER_EMAIL || process.env.EMAIL_USER;

  try {
    const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString("base64");

    const response = await fetch(MAILJET_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: sender, Name: "BakeryApp" },
            To: [{ Email: to }],
            Subject: "Mail de prueba - BakeryApp",
            HTMLPart: "<p>Esto es un mail de prueba para diagnosticar el envío.</p>",
          },
        ],
      }),
    });

    const body = await response.json();
    res.json({ httpStatus: response.status, sender, to, mailjetResponse: body });
  } catch (error) {
    res.json({ error: error.message, sender, to });
  }
};
