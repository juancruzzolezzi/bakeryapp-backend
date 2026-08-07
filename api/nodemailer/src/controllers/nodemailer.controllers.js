import { transporter } from "../nodemailerConfig.js";
import { generateBuyerHtml, generateOwnerHtml } from "../emailHtml.js";

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod }) => {
  // El dueño de la tienda recibe el aviso del pedido: por defecto es la misma
  // cuenta que envía el mail (EMAIL_USER), salvo que se configure otra en
  // SHOP_OWNER_EMAIL.
  const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

  const emailsToSend = [];

  // Mail al comprador: confirmación de compra, sin exponerle su propio contacto.
  if (clientEmail) {
    emailsToSend.push({
      to: "comprador",
      promise: transporter.sendMail({
        from: process.env.EMAIL_USER,
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
      promise: transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: shopOwnerEmail,
        subject: "Nuevo pedido en BakeryApp",
        html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod }),
      }),
    });
  }

  // Si uno de los dos falla (ej: mail del comprador inválido), que no tumbe al otro,
  // pero devolvemos el detalle de qué pasó con cada uno para poder diagnosticarlo.
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
