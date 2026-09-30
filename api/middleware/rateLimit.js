// Límite de intentos de login fallidos, en memoria (sin agregar una
// dependencia más ni una base aparte): alcanza para un solo servidor como
// el de Render. Si el servidor reinicia, los contadores arrancan de cero,
// lo cual está bien para este caso.
//
// Se cuentan solo los intentos FALLIDOS (respuesta 401): un login bien
// hecho resetea el contador, así nadie queda bloqueado por equivocarse
// una o dos veces antes de acertar.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_FAILS_PER_ACCOUNT = 5; // mismo IP + mismo email
const MAX_FAILS_PER_IP = 20; // mismo IP, cualquier email (probar muchas cuentas)

const fails = new Map(); // key -> { count, resetAt }

const getEntry = (key, now) => {
  const entry = fails.get(key);
  if (!entry || entry.resetAt <= now) return null;
  return entry;
};

const registrarFallo = (key, now) => {
  const entry = getEntry(key, now);
  if (entry) {
    entry.count += 1;
  } else {
    fails.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }
};

// Limpieza periódica de entradas vencidas, para que el Map no crezca sin
// límite con IPs que nunca vuelven. "unref": no impide que el proceso termine.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fails) {
    if (entry.resetAt <= now) fails.delete(key);
  }
}, WINDOW_MS).unref();

export const loginRateLimit = (req, res, next) => {
  const now = Date.now();
  const ip = req.ip;
  const email = String(req.body?.email || "").trim().toLowerCase();
  const ipKey = `ip:${ip}`;
  const accountKey = `acc:${ip}:${email}`;

  const bloqueo = [
    [getEntry(accountKey, now), MAX_FAILS_PER_ACCOUNT],
    [getEntry(ipKey, now), MAX_FAILS_PER_IP],
  ].find(([entry, max]) => entry && entry.count >= max);

  if (bloqueo) {
    const retryAfterSec = Math.ceil((bloqueo[0].resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Probá de nuevo en ${Math.ceil(
        retryAfterSec / 60
      )} minutos.`,
    });
  }

  // Se mira el resultado recién cuando el controller ya respondió.
  res.on("finish", () => {
    if (res.statusCode === 401) {
      registrarFallo(accountKey, Date.now());
      registrarFallo(ipKey, Date.now());
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      fails.delete(accountKey);
    }
  });

  next();
};

// Tope simple de pedidos por IP (cuenten o no como fallidos), para rutas
// públicas que disparan mails, como el formulario de arrepentimiento: sin
// esto, cualquiera podía usarlo para mandar mails en masa desde el sitio.
export const ipRateLimit = ({ windowMs, max, message }) => {
  const hits = new Map(); // ip -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(ip);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);

    if (!entry || entry.resetAt <= now) {
      hits.set(req.ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    entry.count += 1;
    next();
  };
};
