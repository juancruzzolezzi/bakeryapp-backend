import mercadopago from "mercadopago";
import { sendOrderConfirmationEmail } from "./orderConfirmation.js";

// Endpoint TEMPORAL de diagnóstico: busca el último pago real y muestra en la
// respuesta (no en logs, a los que no tenemos acceso) qué pasa al intentar
// mandar el mail de confirmación. Borrar una vez resuelto el problema de mails.
export const debugLastPayment = async (req, res) => {
  try {
    const search = await mercadopago.payment.search({
      qs: { sort: "date_created", criteria: "desc", limit: 1 },
    });

    const lastPayment = search.body.results?.[0];

    if (!lastPayment) {
      return res.json({ ok: false, step: "search", message: "No se encontró ningún pago." });
    }

    const info = {
      id: lastPayment.id,
      status: lastPayment.status,
      metadata: lastPayment.metadata,
      payer_email: lastPayment.payer?.email,
      date_created: lastPayment.date_created,
    };

    try {
      await sendOrderConfirmationEmail(lastPayment.id);
      return res.json({ ok: true, step: "sendEmail", payment: info });
    } catch (emailError) {
      return res.json({
        ok: false,
        step: "sendEmail",
        payment: info,
        error: emailError.message,
        stack: emailError.stack,
      });
    }
  } catch (error) {
    return res.json({ ok: false, step: "search", error: error.message, stack: error.stack });
  }
};
