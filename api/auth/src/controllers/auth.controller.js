import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { db } from "../../../db/db.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = "30d";

const firmarToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

// Nunca se manda el hash de la contraseña de vuelta al frontend.
const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
});

export const register = async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: "Faltan email, usuario o contraseña" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña tiene que tener al menos 6 caracteres" });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const yaExiste = db.prepare("SELECT id FROM users WHERE email = ?").get(emailNormalizado);
  if (yaExiste) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db
      .prepare("INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)")
      .run(emailNormalizado, username.trim(), passwordHash);

    const user = { id: result.lastInsertRowid, email: emailNormalizado, username: username.trim() };
    const token = firmarToken(user);

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ error: "No se pudo crear la cuenta. Probá de nuevo." });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Faltan email o contraseña" });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(emailNormalizado);

  if (!user) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  const passwordValida = await bcrypt.compare(password, user.password_hash);
  if (!passwordValida) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  const token = firmarToken(user);
  res.json({ token, user: toPublicUser(user) });
};

// GET /me: para restaurar la sesión al recargar la página (el frontend
// guarda el token en localStorage y lo valida acá al arrancar).
export const me = (req, res) => {
  const user = db.prepare("SELECT id, email, username FROM users WHERE id = ?").get(req.userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  res.json({ user });
};
