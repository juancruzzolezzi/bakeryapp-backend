import { Router } from "express";
import { createOrder, recieveWebhook } from "../controllers/payment.controller.js";
import { successEvent } from "../controllers/success.controllers.js";
import { optionalAuth } from "../../../auth/src/middleware/verifyToken.js";

const router = Router();

// "optionalAuth" (no "requireAuth"): comprar sin cuenta sigue funcionando
// igual que siempre, pero si viene un token válido, createOrder aplica el
// 10% de descuento por cuenta registrada.
router.post("/create-order", optionalAuth, createOrder);

router.get("/success", successEvent);

router.get("/failure", (req, res) => res.send("failure"));

router.get("/pending", (req, res) => res.send("pending"));

router.post("/webhook", recieveWebhook);
router.get("/webhook", recieveWebhook);

export default router;