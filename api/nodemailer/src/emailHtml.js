export const generateHtml = ({ products, totalPay }) => {
  return `
    <p>¡Gracias por tu compra en BakeryApp!</p>
    <img />
    <p>Detalles de la compra:</p>
    <ul>
      ${products
        .map((product) => `<li>${product.title}: $${product.unit_price} x ${product.quantity}</li>`)
        .join("")}
    </ul>
    <p>Total pagado: $${totalPay}</p>
    <p>¡Esperamos que disfrutes de nuestros ricos sabores!</p>
    `;
};