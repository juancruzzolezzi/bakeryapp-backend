import mercadopago from "mercadopago";
import { sendEmail } from "../../../nodemailer/src/controllers/nodemailer.controllers.js";
import dotenv from "dotenv";
dotenv.config();

export const successEvent = async (req, res) => {
    const return_Url = "https://bakeryapp-frontend-production.up.railway.app";

    try {
      if (
        req.query &&
        req.query.status === "approved" &&
        req.query.payment_id
      ) {
        const paymentId = req.query.payment_id;

        // Función para obtener detalles del pago
        const fetchPaymentDetails = async (paymentId) => {
          try {
            const payment = await mercadopago.payment.findById(paymentId);
            return payment;
          } catch (error) {
            console.error("Error al obtener detalles de pago:", error.message);
            throw new Error("No se pudieron obtener los detalles del pago.");
          }
        };

        const paymentDetails = await fetchPaymentDetails(paymentId);

        // Verifica si se recibieron los detalles correctamente
        if (!paymentDetails || !paymentDetails.body) {
          throw new Error("Detalles de pago no disponibles.");
        }

        const products = paymentDetails.body.additional_info.items.map(
          (item) => ({
            title: item.title,
            unit_price: item.unit_price,
            quantity: item.quantity,
          })
        );

        const totalPay = paymentDetails.body.transaction_amount;
        const clientEmail = paymentDetails.body.payer.email;

        // Enviar correo con los detalles
        await sendEmail({ products, totalPay, clientEmail });

        console.log("Correo enviado exitosamente");
      }

      res.redirect(return_Url);
    } catch (error) {
      console.error("Error en successEvent:", error.message);
      res.status(500).send("Error interno del servidor.");
    }
};
