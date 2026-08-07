import mercadopago from "mercadopago";
import dotenv from "dotenv";
dotenv.config();

export const createOrder = async (req, res) => {
  const { cartList } = req.body;

  console.log(req.body);


  try {
    mercadopago.configure({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      access_token:
        process.env.ACCESS_TOKEN,
    });

    const items = cartList.map((product) => ({
      title: product.name,
      currency_id: "ARS",
      unit_price: product.price,
      quantity: product.quantity,
    }));

    const preference = {
      items,
      back_urls: {
        success: `https://bakeryapp-frontend-production.up.railway.app/success`,
        failure: `https://bakeryapp-frontend-production.up.railway.app/failure`,
        pending: `https://bakeryapp-frontend-production.up.railway.app/pending`,
      },
      redirect_urls: {
        failure: "/feilure",
        pending: "/pending",
        success: `https://bakeryapp-frontend-production.up.railway.app`,
      },
      notification_url: `${process.env.NGROK_URL}/webhook`,
      auto_return: "approved",
    };

    const result = await mercadopago.preferences.create(preference);

    res.status(200).json(result.body);
  } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
  }
};

export const recieveWebhook = async (req, res) => {
  const payment = req.body;
  console.log(payment);

  try {
    if (payment.type === "payment") {
      const data = await mercadopago.payment.findById(req.query["data.id"]);
      console.log("Payment Data:", data);
    }

    res.status(200).send("webhook");
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return res.sendStatus(500).json({ error: error.message });
  }
};
