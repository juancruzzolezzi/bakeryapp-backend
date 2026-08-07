import { resend } from "../nodemailerConfig.js";
import { generateBuyerHtml, generateOwnerHtml } from "../emailHtml.js";

// Remitente: por defecto usa el dominio de pruebas de Resend (funciona sin
// verificar nada, manda a cualquier destinatario). Si más adelante verificás
// tu propio dominio en Resend, configurá RESEND_FROM con un mail de ese dominio.
const FROM = process.env.RESEND_FROM || "BakeryApp <onboarding@resend.dev>";

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod }) => {
  // El dueño de la tienda recibe el aviso del pedido: por defecto es la misma
  // cuenta que antes se usaba para SMTP (EMAIL_USER), salvo que se configure
  // otra en SHOP_OWNER_EMAIL.
  const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

  const emailsToSend = [];

  // Mail al comprador: confirmación de compra, sin exponerle su propio contacto.
  if (clientEmail) {
    emailsToSend.push({
      to: "comprador",
      promise: resend.emails.send({
        from: FROM,
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
      promise: resend.emails.send({
        from: FROM,
        to: shopOwnerEmail,
        subject: "Nuevo pedido en BakeryApp",
        html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod }),
      }),
    });
  }

  // Si uno de los dos falla (ej: mail del comprador inválido), que no tumbe al otro,
  // pero devolvemos el detalle de qué pasó con cada uno para poder diagnosticarlo.
  const settled = await Promise.allSettled(emailsToSend.map((e) => e.promise));
  const results = settled.map((result, i) => {
    if (result.status === "rejected") {
      return { to: emailsToSend[i].to, ok: false, error: result.reason?.message };
    }
    // El SDK de Resend no rechaza la promesa si la API devuelve un error;
    // lo entrega en result.value.error.
    if (result.value?.error) {
      return { to: emailsToSend[i].to, ok: false, error: result.value.error.message };
    }
    return { to: emailsToSend[i].to, ok: true };
  });
  results.forEach((r) => {
    if (!r.ok) console.error(`Error al enviar mail a ${r.to}:`, r.error);
  });
  return results;
};
