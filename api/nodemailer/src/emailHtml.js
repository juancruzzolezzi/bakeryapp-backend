// Foto de fondo del sitio, usada como "foto de perfil" de la marca en los mails.
const LOGO_URL = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/Portada.jpg`
  : "https://bakeryapp-frontend.vercel.app/Portada.jpg";

const productListHtml = (products) =>
  products
    .map(
      (product) => `
      <tr>
        <td style="padding: 8px 0; vertical-align: middle;">
          ${
            product.picture_url
              ? `<img src="${product.picture_url}" alt="${product.title}" width="60" height="60" style="border-radius: 8px; object-fit: cover; display: block;" />`
              : ""
          }
        </td>
        <td style="padding: 8px 0 8px 12px; vertical-align: middle;">
          ${product.title}: $${product.unit_price} x ${product.quantity}
        </td>
      </tr>`
    )
    .join("");

const deliveryLabel = (deliveryType) =>
  deliveryType === "takeaway" ? "Retiro en el local (Take Away)" : "Delivery";

// Mail para el comprador: confirmación de compra, sin datos de contacto propios.
export const generateBuyerHtml = ({ products, totalPay, deliveryType, address }) => {
  return `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${LOGO_URL}" alt="BakeryApp" width="70" height="70" style="border-radius: 50%; object-fit: cover;" />
    </div>
    <p>¡Gracias por tu compra en BakeryApp!</p>
    <p>Detalles de tu pedido:</p>
    <table cellpadding="0" cellspacing="0">${productListHtml(products)}</table>
    <p>Total pagado: $${totalPay}</p>
    ${deliveryType ? `<p><strong>Entrega:</strong> ${deliveryLabel(deliveryType)}</p>` : ""}
    ${deliveryType === "delivery" && address ? `<p><strong>Dirección:</strong> ${address}</p>` : ""}
    <p>En breve te vamos a contactar para coordinar la entrega. ¡Gracias por elegirnos!</p>
    `;
};

// Mail para el dueño de la tienda: aviso de pedido nuevo con el contacto del comprador bien visible.
export const generateOwnerHtml = ({ products, totalPay, clientContact, contactMethod, deliveryType, address }) => {
  const contactLabel = contactMethod === "whatsapp" ? "WhatsApp" : "Instagram";
  return `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${LOGO_URL}" alt="BakeryApp" width="70" height="70" style="border-radius: 50%; object-fit: cover;" />
    </div>
    <p>¡Nuevo pedido en BakeryApp!</p>
    ${clientContact ? `<p><strong>Contactar por ${contactLabel}: ${clientContact}</strong></p>` : ""}
    ${deliveryType ? `<p><strong>Entrega:</strong> ${deliveryLabel(deliveryType)}</p>` : ""}
    ${deliveryType === "delivery" && address ? `<p><strong>Dirección de entrega:</strong> ${address}</p>` : ""}
    <p>Detalles de la compra:</p>
    <table cellpadding="0" cellspacing="0">${productListHtml(products)}</table>
    <p>Total pagado: $${totalPay}</p>
    `;
};
