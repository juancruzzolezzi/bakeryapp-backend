import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const leerToken = (req) => {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");
  return tipo === "Bearer" ? token : null;
};

// Para rutas que REQUIEREN estar logueado (ej: GET /me).
export const requireAuth = (req, res, next) => {
  const token = leerToken(req);
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Sesión inválida o vencida" });
  }
};

// Para rutas donde el login es OPCIONAL pero cambia el resultado si hay
// sesión (ej: /create-order, que aplica 10% de descuento a cuentas
// registradas). Si el token es inválido, sigue como invitado en vez de
// rechazar la petición entera.
export const optionalAuth = (req, res, next) => {
  const token = leerToken(req);
  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
  } catch {
    req.userId = null;
  }
  next();
};
