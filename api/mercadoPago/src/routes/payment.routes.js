import { Router } from "express";
import { createOrder, recieveWebhook } from "../controllers/payment.controller.js";
import { successEvent } from "../controllers/success.controllers.js";
import { debugMailjet } from "../controllers/debug.controller.js";

const router = Router();

router.post("/create-order", createOrder);

router.get("/success", successEvent);

router.get("/failure", (req, res) => res.send("failure"));

router.get("/pending", (req, res) => res.send("pending"));

router.post("/webhook", recieveWebhook);
router.get("/webhook", recieveWebhook);

// TEMPORAL: ver debug.controller.js
router.get("/debug/mailjet", debugMailjet);

export default router;