import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { db } from "../../../db/db.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const TOKEN_EXPIRES_IN = "30d";

// Preparados una sola vez acá arriba (no adentro de cada handler): misma
// idea que en products.routes.js.
const selectUserByEmail = db.prepare("SELECT id FROM users WHERE email = ?");
const selectFullUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const selectPublicUserById = db.prepare("SELECT id, email, username FROM users WHERE id = ?");
const insertUser = db.prepare(
  "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)"
);
const insertGoogleUser = db.prepare(
  "INSERT INTO users (email, username, password_hash, google_id) VALUES (?, ?, '', ?)"
);
const linkGoogleId = db.prepare("UPDATE users SET google_id = ? WHERE id = ?");

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
  const yaExiste = selectUserByEmail.get(emailNormalizado);
  if (yaExiste) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = insertUser.run(emailNormalizado, username.trim(), passwordHash);

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
  const user = selectFullUserByEmail.get(emailNormalizado);

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

// POST /auth/google: el frontend obtiene un "credential" (ID token JWT) de
// Google Identity Services y lo manda acá. Lo validamos contra Google, y
// si el email ya tenía cuenta la vinculamos; si no, creamos una nueva.
export const googleLogin = async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: "Falta el token de Google" });
  }
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Login con Google no configurado" });
  }

  try {
    // tokeninfo valida firma, expiración y emisor por nosotros.
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!resp.ok) {
      return res.status(401).json({ error: "Token de Google inválido" });
    }
    const payload = await resp.json();

    const audienceOk = payload.aud === GOOGLE_CLIENT_ID;
    const issuerOk =
      payload.iss === "accounts.google.com" ||
      payload.iss === "https://accounts.google.com";
    if (!audienceOk || !issuerOk || payload.email_verified === "false") {
      return res.status(401).json({ error: "Token de Google inválido" });
    }

    const email = (payload.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Google no devolvió un email" });
    }
    const nombre = (payload.name || payload.given_name || email.split("@")[0]).trim();

    let user = selectFullUserByEmail.get(email);

    if (user) {
      if (!user.google_id) {
        linkGoogleId.run(payload.sub, user.id);
      }
    } else {
      const result = insertGoogleUser.run(email, nombre, payload.sub);
      user = { id: result.lastInsertRowid, email, username: nombre };
    }

    const token = firmarToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error("Error en login con Google:", error);
    res.status(500).json({ error: "No se pudo ingresar con Google. Probá de nuevo." });
  }
};

// GET /me: para restaurar la sesión al recargar la página (el frontend
// guarda el token en localStorage y lo valida acá al arrancar).
export const me = (req, res) => {
  const user = selectPublicUserById.get(req.userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  res.json({ user });
};
