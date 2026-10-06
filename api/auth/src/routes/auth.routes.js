import { Router } from "express";
import { register, login, me, googleLogin } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/verifyToken.js";
import { loginRateLimit, ipRateLimit } from "../../../middleware/rateLimit.js";

const router = Router();

// Tope por IP para que no se puedan crear cuentas en masa (cada cuenta
// tiene 10% OFF). Generoso a propósito: varios clientes pueden compartir
// IP (wifi del local, datos móviles).
router.post(
  "/register",
  ipRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Se crearon muchas cuentas desde esta conexión. Probá de nuevo en un rato.",
  }),
  register
);
// Tope de intentos fallidos por IP/email (ver middleware/rateLimit.js).
router.post("/login", loginRateLimit, login);
router.post(
  "/auth/google",
  ipRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: "Demasiados intentos seguidos. Probá de nuevo en unos minutos.",
  }),
  googleLogin
);
router.get("/me", requireAuth, me);

export default router;
