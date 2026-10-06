import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Para las rutas que modifican el catálogo (crear, editar y borrar
// productos). Antes estaban abiertas: cualquiera con un "curl" podía borrar
// todo o poner un producto a $1, y como el checkout toma el precio de la
// base, Mercado Pago cobraba ese $1.
//
// Se manda la clave en el header "x-admin-key", con el mismo valor que
// ADMIN_KEY en el .env (y en las variables de entorno de Render). Si
// ADMIN_KEY no está configurada, las rutas quedan cerradas para todos.
export const requireAdmin = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: "Edición del catálogo no configurada (falta ADMIN_KEY)" });
  }

  const enviada = Buffer.from(String(req.headers["x-admin-key"] || ""));
  const esperada = Buffer.from(adminKey);
  // timingSafeEqual: compara sin revelar por el tiempo de respuesta cuántos
  // caracteres coinciden. Exige el mismo largo, por eso se chequea antes.
  const valida =
    enviada.length === esperada.length && crypto.timingSafeEqual(enviada, esperada);

  if (!valida) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
};
