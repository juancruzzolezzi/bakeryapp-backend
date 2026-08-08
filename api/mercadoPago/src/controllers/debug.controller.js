import mercadopago from "mercadopago";
import { sendOrderConfirmationEmail } from "./orderConfirmation.js";

// Endpoint TEMPORAL de diagnóstico: busca el último pago aprobado real y
// muestra en la respuesta (no en logs, a los que no tenemos acceso) qué pasa
// al intentar mandar el mail de confirmación. Borrar una vez resuelto.
export const debugLastPayment = async (req, res) => {
  try {
    const search = await mercadopago.payment.search({
      qs: { sort: "date_created", criteria: "desc", limit: 5 },
    });

    const payments = (search.body.results || []).map((p) => ({
      id: p.id,
      status: p.status,
      status_detail: p.status_detail,
      metadata: p.metadata,
      payer_email: p.payer?.email,
      date_created: p.date_created,
      transaction_amount: p.transaction_amount,
    }));

    if (payments.length === 0) {
      return res.json({ ok: false, step: "search", message: "No se encontró ningún pago." });
    }

    const targetId = req.query.paymentId || payments.find((p) => p.status === "approved")?.id;

    if (!targetId) {
      return res.json({ ok: true, step: "search", payments, note: "No hay ningún pago 'approved' entre los últimos 5." });
    }

    try {
      const outcome = await sendOrderConfirmationEmail(targetId, { force: true });
      return res.json({ ok: true, step: "sendEmail", targetId, outcome, payments });
    } catch (emailError) {
      return res.json({
        ok: false,
        step: "sendEmail",
        targetId,
        payments,
        error: emailError.message,
        stack: emailError.stack,
      });
    }
  } catch (error) {
    return res.json({ ok: false, step: "search", error: error.message, stack: error.stack });
  }
};
