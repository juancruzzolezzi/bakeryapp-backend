import { getFrontendUrl } from "../../mercadoPago/config.js";

// Foto de fondo del sitio, usada como "foto de perfil" de la marca en los mails.
const LOGO_URL = `${getFrontendUrl()}/Portada.jpg`;

// Contacto, dirección y nombres de producto terminan adentro del HTML del
// mail: el contacto y la dirección los escribe el cliente, así que se
// escapan siempre (antes iban tal cual).
const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

const formatearPrecio = (monto) => `$${Number(monto || 0).toLocaleString("es-AR")}`;

const productListHtml = (products) =>
  products
    .map(
      (product) => `
      <tr>
        <td style="padding: 8px 0; vertical-align: middle;">
          ${
            product.picture_url
              ? `<img src="${escapeHtml(product.picture_url)}" alt="${escapeHtml(product.title)}" width="60" height="60" style="border-radius: 8px; object-fit: cover; display: block;" />`
              : ""
          }
        </td>
        <td style="padding: 8px 0 8px 12px; vertical-align: middle;">
          ${escapeHtml(product.title)}: ${formatearPrecio(product.unit_price)} x ${escapeHtml(product.quantity)}
        </td>
      </tr>`
    )
    .join("");

const deliveryLabel = (deliveryType) =>
  deliveryType === "takeaway" ? "Retiro en el local (Take Away)" : "Delivery";

// Botón con estilos en línea: los clientes de mail ignoran casi todo el CSS.
const botonHtml = (url, texto) => `
    <p style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(url)}" style="display: inline-block; background: #2b1d12; color: #f6ecdb; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: bold;">${texto}</a>
    </p>`;

// Mail para el comprador: confirmación de compra, sin datos de contacto propios.
export const generateBuyerHtml = ({ orderCode, trackingUrl, products, totalPay, deliveryType, address }) => {
  return `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${LOGO_URL}" alt="Bakery" width="70" height="70" style="border-radius: 50%; object-fit: cover;" />
    </div>
    <p>¡Gracias por tu compra en Bakery!</p>
    ${orderCode ? `<p>Tu número de pedido es <strong>${escapeHtml(orderCode)}</strong>.</p>` : ""}
    ${trackingUrl ? `${botonHtml(trackingUrl, "Seguir mi pedido")}
    <p style="text-align: center; color: #6e604c; font-size: 13px;">Ahí ves en qué paso está tu pedido. Guardá este mail para volver a entrar.</p>` : ""}
    <p>Detalles de tu pedido:</p>
    <table cellpadding="0" cellspacing="0">${productListHtml(products)}</table>
    <p>Total pagado: ${formatearPrecio(totalPay)}</p>
    ${deliveryType ? `<p><strong>Entrega:</strong> ${deliveryLabel(deliveryType)}</p>` : ""}
    ${deliveryType === "delivery" && address ? `<p><strong>Dirección:</strong> ${escapeHtml(address)}</p>` : ""}
    <p>En breve te vamos a contactar para coordinar la entrega. ¡Gracias por elegirnos!</p>
    `;
};

// Mail para el dueño de la tienda: aviso de pedido nuevo con el contacto del comprador bien visible.
export const generateOwnerHtml = ({ orderCode, panelUrl, products, totalPay, clientContact, contactMethod, deliveryType, address }) => {
  const contactLabel = contactMethod === "whatsapp" ? "WhatsApp" : "Instagram";
  return `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${LOGO_URL}" alt="Bakery" width="70" height="70" style="border-radius: 50%; object-fit: cover;" />
    </div>
    <p>¡Nuevo pedido en Bakery!${orderCode ? ` <strong>${escapeHtml(orderCode)}</strong>` : ""}</p>
    ${clientContact ? `<p><strong>Contactar por ${contactLabel}: ${escapeHtml(clientContact)}</strong></p>` : ""}
    ${deliveryType ? `<p><strong>Entrega:</strong> ${deliveryLabel(deliveryType)}</p>` : ""}
    ${deliveryType === "delivery" && address ? `<p><strong>Dirección de entrega:</strong> ${escapeHtml(address)}</p>` : ""}
    <p>Detalles de la compra:</p>
    <table cellpadding="0" cellspacing="0">${productListHtml(products)}</table>
    <p>Total pagado: ${formatearPrecio(totalPay)}</p>
    ${orderCode && panelUrl ? botonHtml(panelUrl, "Abrir el panel de pedidos") : ""}
    `;
};
