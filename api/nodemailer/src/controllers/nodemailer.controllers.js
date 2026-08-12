import { MAILJET_API_URL, MAILJET_API_KEY, MAILJET_SECRET_KEY } from "../nodemailerConfig.js";
import { generateBuyerHtml, generateOwnerHtml } from "../emailHtml.js";

// Remitente: tiene que ser un mail verificado en Mailjet (Sender addresses and domains).
const SENDER_EMAIL = process.env.MAILJET_SENDER_EMAIL || process.env.EMAIL_USER;
const SENDER_NAME = "BakeryApp";

const sendViaMailjet = async ({ to, subject, html }) => {
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
          From: { Email: SENDER_EMAIL, Name: SENDER_NAME },
          To: [{ Email: to }],
          Subject: subject,
          HTMLPart: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailjet respondió ${response.status}: ${body}`);
  }
};

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod, deliveryType, address }) => {
  // El dueño de la tienda recibe el aviso del pedido: por defecto es la misma
  // cuenta configurada como EMAIL_USER, salvo que se configure otra en
  // SHOP_OWNER_EMAIL.
  const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

  const emailsToSend = [];

  // Mail al comprador: confirmación de compra, sin exponerle su propio contacto.
  if (clientEmail) {
    emailsToSend.push({
      to: "comprador",
      promise: sendViaMailjet({
        to: clientEmail,
        subject: "Confirmación de compra en BakeryApp",
        html: generateBuyerHtml({ products, totalPay, deliveryType, address }),
      }),
    });
  }

  // Mail al dueño: aviso de pedido nuevo con el Instagram/WhatsApp del comprador,
  // más el tipo de entrega elegido y la dirección si pidió delivery.
  if (shopOwnerEmail) {
    emailsToSend.push({
      to: "dueño",
      promise: sendViaMailjet({
        to: shopOwnerEmail,
        subject: "Nuevo pedido en BakeryApp",
        html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod, deliveryType, address }),
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
