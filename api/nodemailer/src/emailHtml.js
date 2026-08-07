// Mail para el comprador: confirmación de compra, sin datos de contacto propios.
export const generateBuyerHtml = ({ products, totalPay }) => {
  return `
    <p>¡Gracias por tu compra en BakeryApp!</p>
    <p>Detalles de tu pedido:</p>
    <ul>
      ${products
        .map((product) => `<li>${product.title}: $${product.unit_price} x ${product.quantity}</li>`)
        .join("")}
    </ul>
    <p>Total pagado: $${totalPay}</p>
    <p>En breve te vamos a contactar para coordinar la entrega. ¡Gracias por elegirnos!</p>
    `;
};

// Mail para el dueño de la tienda: aviso de pedido nuevo con el contacto del comprador bien visible.
export const generateOwnerHtml = ({ products, totalPay, clientContact, contactMethod }) => {
  const contactLabel = contactMethod === "whatsapp" ? "WhatsApp" : "Instagram";
  return `
    <p>¡Nuevo pedido en BakeryApp!</p>
    ${clientContact ? `<p><strong>Contactar por ${contactLabel}: ${clientContact}</strong></p>` : ""}
    <p>Detalles de la compra:</p>
    <ul>
      ${products
        .map((product) => `<li>${product.title}: $${product.unit_price} x ${product.quantity}</li>`)
        .join("")}
    </ul>
    <p>Total pagado: $${totalPay}</p>
    `;
};
