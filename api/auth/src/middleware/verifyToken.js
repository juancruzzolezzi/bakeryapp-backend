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
// registradas). Sin token, sigue como invitado.
//
// Con un token vencido o inválido responde 401 en vez de seguir como
// invitado en silencio: si no, el cliente veía el 10% OFF en la pantalla
// (el frontend todavía lo creía logueado) y Mercado Pago le cobraba el
// precio completo. Con el 401, el frontend cierra la sesión y le avisa.
export const optionalAuth = (req, res, next) => {
  const token = leerToken(req);
  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({
      error: "Tu sesión venció. Volvé a iniciar sesión para tener el 10% OFF.",
      code: "SESSION_EXPIRED",
    });
  }
};
