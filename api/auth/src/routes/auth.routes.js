import { Router } from "express";
import { register, login, me, googleLogin } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/verifyToken.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/auth/google", googleLogin);
router.get("/me", requireAuth, me);

export default router;
