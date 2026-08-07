import { transporter } from "../nodemailerConfig.js";
import { generateHtml } from "../emailHtml.js";

export const sendEmail = async ({ products, totalPay, clientEmail, clientContact, contactMethod }) => {
  try {
    const emailHtml = generateHtml({ products, totalPay, clientContact, contactMethod });

    const email = {
      from: "augustoempresaprueba@gmail.com",
      to: [clientEmail, "viggianoa179@gmail.com"].filter(Boolean).join(", "),
      subject: "Confirmación de compra en BakeryApp",
      html: emailHtml,
    };

    await transporter.sendMail(email);

  } catch (error) {
    throw console.log(error);
  }
};
