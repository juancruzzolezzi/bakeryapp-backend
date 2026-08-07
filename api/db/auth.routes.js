import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// POST /auth/register
router.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: "email, username y password son requeridos" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ code: "auth/email-already-in-use", error: "Ese email ya está registrado" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)")
    .run(email, username, passwordHash);

  const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({ email, username, token });
});

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Permite iniciar sesión con el email o con el nombre de usuario
  const user = db
    .prepare("SELECT * FROM users WHERE email = ? OR username = ?")
    .get(email, email);
  if (!user) {
    return res.status(404).json({ code: "auth/user-not-found", error: "No existe un usuario con ese email o nombre de usuario" });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ code: "auth/wrong-password", error: "Contraseña incorrecta" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  res.json({ email: user.email, username: user.username, token });
});

export default router;
