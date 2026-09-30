export const PORT = 3000;

export const HOST = `http://localhost:${PORT}`;

// FRONTEND_URL puede traer varios dominios separados por coma (ver CORS en
// index.js): para armar links de vuelta (redirects de Mercado Pago) se usa
// siempre el primero, que es el dominio principal del sitio.
export const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "https://bakeryapp-frontend.vercel.app")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");

// Barrios donde hacemos delivery. Tiene que coincidir con DELIVERY_ZONES en
// el frontend (constants/deliveryZones.js): ahí solo se usa para armar el
// selector y avisar antes de pagar; acá es donde se rechaza de verdad un
// pedido con delivery fuera de zona.
// TODO: ajustar a la cobertura real del local.
export const DELIVERY_ZONES = [
  "Belgrano",
  "Colegiales",
  "Coghlan",
  "Núñez",
  "Palermo",
  "Saavedra",
  "Villa Ortúzar",
  "Villa Urquiza",
];
