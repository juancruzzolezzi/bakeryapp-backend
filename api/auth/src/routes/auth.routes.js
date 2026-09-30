import { Router } from "express";
import { register, login, me, googleLogin } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/verifyToken.js";
import { loginRateLimit } from "../../../middleware/rateLimit.js";

const router = Router();

router.post("/register", register);
// Tope de intentos fallidos por IP/email (ver middleware/rateLimit.js).
router.post("/login", loginRateLimit, login);
router.post("/auth/google", googleLogin);
router.get("/me", requireAuth, me);

export default router;
