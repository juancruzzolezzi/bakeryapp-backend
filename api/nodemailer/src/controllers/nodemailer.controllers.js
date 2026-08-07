import { transporter } from "../nodemailerConfig.js";
import { generateHtml } from "../emailHtml.js";

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod }) => {
  try {
    const emailHtml = generateHtml({ products, totalPay, clientContact, contactMethod });

    // El dueño de la tienda recibe una copia de cada pedido: por defecto es la
    // misma cuenta que envía el mail (EMAIL_USER), salvo que se configure otra
    // en SHOP_OWNER_EMAIL.
    const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

    const email = {
      from: process.env.EMAIL_USER,
      to: [clientEmail, shopOwnerEmail].filter(Boolean).join(", "),
      subject: "Confirmación de compra en BakeryApp",
      html: emailHtml,
    };

    await transporter.sendMail(email);

  } catch (error) {
    throw console.log(error);
  }
};
