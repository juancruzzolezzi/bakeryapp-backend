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
    emailsToSend.push(
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: "Confirmación de compra en BakeryApp",
        html: generateBuyerHtml({ products, totalPay }),
      })
    );
  }

  // Mail al dueño: aviso de pedido nuevo con el Instagram/WhatsApp del comprador.
  if (shopOwnerEmail) {
    emailsToSend.push(
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: shopOwnerEmail,
        subject: "Nuevo pedido en BakeryApp",
        html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod }),
      })
    );
  }

  // Si uno de los dos falla (ej: mail del comprador inválido), que no tumbe al otro.
  const results = await Promise.allSettled(emailsToSend);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Error al enviar uno de los mails:", result.reason);
    }
  });
};
