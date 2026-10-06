// Estados de un pedido y cómo se muestran. Sin base de datos ni Express,
// para poder probarlo solo (ver estados.test.js).
//
// "pendiente_pago": se creó al ir a Mercado Pago y todavía no se aprobó
// el pago. El resto son los pasos que ve el cliente en /pedido/:token y
// que el local avanza desde el panel.
export const ESTADOS = ["pendiente_pago", "recibido", "preparacion", "camino", "entregado"];

// Los que el local puede elegir desde el panel (no puede volver un pedido
// a "pendiente_pago": eso solo lo decide Mercado Pago).
export const ESTADOS_DEL_LOCAL = ["recibido", "preparacion", "camino", "entregado"];

// Columna de la base donde se guarda la hora en que el pedido llegó a
// cada estado.
export const COLUMNA_HORA = {
  recibido: "paid_at",
  preparacion: "preparing_at",
  camino: "shipped_at",
  entregado: "delivered_at",
};

export const esEstadoDelLocal = (estado) => ESTADOS_DEL_LOCAL.includes(estado);

// "BK-0142": número corto para hablar del pedido por WhatsApp o en el
// local. El link de seguimiento usa otro valor, al azar (ver "token").
export const codigoPedido = (id) => `BK-${String(id).padStart(4, "0")}`;

// El token del link de seguimiento: 32 caracteres hexadecimales.
export const esTokenValido = (token) => typeof token === "string" && /^[a-f0-9]{32}$/.test(token);

// La página de seguimiento es pública (cualquiera con el link la abre), así
// que el contacto se muestra a medias: alcanza para que el cliente lo
// reconozca, no para que otro lo use.
export const enmascararContacto = (contacto, metodo) => {
  const valor = String(contacto || "").trim();
  if (!valor) return "";
  if (metodo === "whatsapp") {
    const digitos = valor.replace(/\D/g, "");
    // Espacio que no corta línea: si no, "••••" y "4821" quedaban en
    // renglones distintos en el celular.
    return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : "••••";
  }
  const usuario = valor.replace(/^@/, "");
  return `@${usuario.slice(0, 2)}•••`;
};

// SQLite guarda "2026-10-06 17:05:00" en UTC: se pasa a ISO con "Z" para
// que el navegador lo muestre en la hora local del cliente.
export const aIso = (fechaSqlite) => (fechaSqlite ? `${fechaSqlite.replace(" ", "T")}Z` : null);

const parsearItems = (texto) => {
  try {
    const items = JSON.parse(texto);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const base = (row) => ({
  code: codigoPedido(row.id),
  token: row.token,
  status: row.status,
  createdAt: aIso(row.created_at),
  paidAt: aIso(row.paid_at),
  preparingAt: aIso(row.preparing_at),
  shippedAt: aIso(row.shipped_at),
  deliveredAt: aIso(row.delivered_at),
  deliveryType: row.delivery_type || "",
  deliveryZone: row.delivery_zone || "",
  address: row.address || "",
  items: parsearItems(row.items),
  subtotal: row.subtotal,
  discount: row.discount,
  shipping: row.shipping,
  total: row.total,
});

// Lo que ve el cliente (link de seguimiento y "Mis pedidos").
export const pedidoPublico = (row) => ({
  ...base(row),
  contactMethod: row.contact_method || "",
  contact: enmascararContacto(row.contact, row.contact_method),
});

// Lo que ve el local en el panel: el contacto completo, para escribirle.
export const pedidoParaElLocal = (row) => ({
  ...base(row),
  id: row.id,
  contactMethod: row.contact_method || "",
  contact: row.contact || "",
});
