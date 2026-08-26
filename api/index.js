import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paymentRoutes from "./mercadoPago/src/routes/payment.routes.js";
import nodemailerRoutes from "./nodemailer/src/routes/nodemailer.routes.js";
import productsRoutes from "./db/products.routes.js";
import authRoutes from "./auth/src/routes/auth.routes.js";
import { PORT } from "./mercadoPago/config.js";
import morgan from "morgan";
import cors from "cors";
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

dotenv.config();

app.use(cors());
// "express.json()" ya cubre lo que antes hacía "body-parser" (se fusionó
// a Express hace años); tenerlos los dos era parsear el body dos veces
// por request para nada.
app.use(express.json());
app.use(morgan("dev"));
// "maxAge": las fotos de producto no cambian de nombre cuando se editan
// (se pisa el mismo archivo), así que sin esto el navegador las volvía a
// descargar en cada visita en vez de servirlas desde su caché local.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "public/uploads"), {
    maxAge: "7d",
  })
);
// Para el "ping" que lo mantiene despierto (ver .github/workflows en este
// repo): no toca la base de datos, solo confirma que el servidor está
// arriba, lo más liviano posible.
app.get("/health", (req, res) => res.status(200).send("ok"));

app.use(paymentRoutes);
app.use(nodemailerRoutes);
app.use(productsRoutes);
app.use(authRoutes);

app.listen(PORT);
console.log("Server listening on port", PORT);
