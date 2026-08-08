import { BREVO_API_URL, BREVO_API_KEY } from "../nodemailerConfig.js";
import { generateBuyerHtml, generateOwnerHtml } from "../emailHtml.js";

// Remitente: tiene que ser un mail verificado en Brevo (Senders → Add a sender).
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
const SENDER_NAME = "BakeryApp";

const sendViaBrevo = async ({ to, subject, html }) => {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo respondió ${response.status}: ${body}`);
  }
};

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod }) => {
  // El dueño de la tienda recibe el aviso del pedido: por defecto es la misma
  // cuenta configurada como EMAIL_USER, salvo que se configure otra en
  // SHOP_OWNER_EMAIL.
  const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

  const emailsToSend = [];

  // Mail al comprador: confirmación de compra, sin exponerle su propio contacto.
  if (clientEmail) {
    emailsToSend.push({
      to: "comprador",
      promise: sendViaBrevo({
        to: clientEmail,
        subject: "Confirmación de compra en BakeryApp",
        html: generateBuyerHtml({ products, totalPay }),
      }),
    });
  }

  // Mail al dueño: aviso de pedido nuevo con el Instagram/WhatsApp del comprador.
  if (shopOwnerEmail) {
    emailsToSend.push({
      to: "dueño",
      promise: sendViaBrevo({
        to: shopOwnerEmail,
        subject: "Nuevo pedido en BakeryApp",
        html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod }),
      }),
    });
  }

  // Si uno de los dos falla (ej: mail del comprador inválido), que no tumbe al otro.
  const settled = await Promise.allSettled(emailsToSend.map((e) => e.promise));
  const results = settled.map((result, i) => ({
    to: emailsToSend[i].to,
    ok: result.status === "fulfilled",
    error: result.status === "rejected" ? result.reason?.message : undefined,
  }));
  results.forEach((r) => {
    if (!r.ok) console.error(`Error al enviar mail a ${r.to}:`, r.error);
  });
  return results;
};
