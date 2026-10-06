import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paymentRoutes from "./mercadoPago/src/routes/payment.routes.js";
import productsRoutes from "./db/products.routes.js";
import authRoutes from "./auth/src/routes/auth.routes.js";
import arrepentimientoRoutes from "./legal/arrepentimiento.routes.js";
import { PORT } from "./mercadoPago/config.js";
import morgan from "morgan";
import cors from "cors";
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

dotenv.config();

// Render (y cualquier hosting con proxy adelante) pasa la IP real del
// cliente en X-Forwarded-For: sin esto, "req.ip" sería siempre la del
// proxy y el límite de intentos de login (ver middleware/rateLimit.js)
// bloquearía a todos los usuarios juntos.
app.set("trust proxy", 1);
// No anunciar "X-Powered-By: Express" en cada respuesta.
app.disable("x-powered-by");

// CORS: solo el dominio del sitio puede llamar a la API desde un
// navegador. FRONTEND_URL admite varios dominios separados por coma (ej:
// el de producción y un preview de Vercel). En desarrollo se suma
// localhost:3001/3000 (CRA) para poder probar sin configurar nada. Render
// define RENDER=true en sus servidores, así que ahí nunca se suma.
//
// Los pedidos sin "Origin" (webhook de Mercado Pago, el ping de
// keep-alive, curl) no son de un navegador y CORS no aplica: se dejan pasar.
const allowedOrigins = (
  process.env.FRONTEND_URL || "https://bakeryapp-frontend.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (!process.env.RENDER && process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
  })
);
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
app.use(productsRoutes);
app.use(authRoutes);
app.use(arrepentimientoRoutes);

// Cualquier error que llegue hasta acá (ej: un body con JSON mal armado)
// responde JSON como el resto de la API, en vez de la página HTML de error
// de Express con el stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("Error no manejado:", err);
  res.status(status).json({
    error: status >= 500 ? "Error interno del servidor" : "Pedido inválido",
  });
});
app.listen(PORT);
console.log("Server listening on port", PORT);
