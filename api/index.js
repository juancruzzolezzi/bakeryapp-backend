import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paymentRoutes from "./mercadoPago/src/routes/payment.routes.js";
import nodemailerRoutes from "./nodemailer/src/routes/nodemailer.routes.js";
import productsRoutes from "./db/products.routes.js";
import { PORT } from "./mercadoPago/config.js";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(bodyParser.json());
// "maxAge": las fotos de producto no cambian de nombre cuando se editan
// (se pisa el mismo archivo), así que sin esto el navegador las volvía a
// descargar en cada visita en vez de servirlas desde su caché local.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "public/uploads"), {
    maxAge: "7d",
  })
);
app.use(paymentRoutes);
app.use(nodemailerRoutes);
app.use(productsRoutes);

app.listen(PORT);
console.log("Server listening on port", PORT);
