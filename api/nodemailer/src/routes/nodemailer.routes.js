import { Router } from "express";
import { sendEmail } from "../../../nodemailer/src/controllers/nodemailer.controllers.js";

const router = Router();

router.post("/send-email", sendEmail);

export default router;