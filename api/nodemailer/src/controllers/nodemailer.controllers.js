import { resend } from "../nodemailerConfig.js";
import { generateOwnerHtml } from "../emailHtml.js";

// Remitente: dominio de pruebas de Resend. Sin verificar un dominio propio en
// resend.com/domains, Resend solo deja mandar a la propia cuenta del dueño
// (no a los compradores) — por eso el mail de confirmación al comprador está
// deshabilitado por ahora; solo avisamos al dueño de la tienda.
const FROM = process.env.RESEND_FROM || "BakeryApp <onboarding@resend.dev>";

export const sendEmail = async ({ products, totalPay, clientContact, contactMethod }) => {
  // El dueño de la tienda recibe el aviso del pedido: por defecto es la misma
  // cuenta configurada como EMAIL_USER, salvo que se configure otra en
  // SHOP_OWNER_EMAIL.
  const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

  if (!shopOwnerEmail) return [];

  const { error } = await resend.emails.send({
    from: FROM,
    to: shopOwnerEmail,
    subject: "Nuevo pedido en BakeryApp",
    html: generateOwnerHtml({ products, totalPay, clientContact, contactMethod }),
  });

  const result = { to: "dueño", ok: !error, error: error?.message };
  if (!result.ok) console.error("Error al enviar mail al dueño:", result.error);
  return [result];
};
