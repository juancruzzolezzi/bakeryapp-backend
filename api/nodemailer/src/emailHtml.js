export const generateHtml = ({ products, totalPay, clientContact, contactMethod }) => {
  const contactLabel = contactMethod === "whatsapp" ? "WhatsApp" : "Instagram";
  return `
    <p>¡Nuevo pedido confirmado en BakeryApp!</p>
    <p>Detalles de la compra:</p>
    <ul>
      ${products
        .map((product) => `<li>${product.title}: $${product.unit_price} x ${product.quantity}</li>`)
        .join("")}
    </ul>
    <p>Total pagado: $${totalPay}</p>
    ${clientContact ? `<p><strong>Contactar por ${contactLabel}: ${clientContact}</strong></p>` : ""}
    <p>¡Esperamos que disfrutes de nuestros ricos sabores!</p>
    `;
};