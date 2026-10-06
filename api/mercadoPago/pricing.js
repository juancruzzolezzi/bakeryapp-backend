// Reglas de precio del checkout, separadas del controller para poder
// probarlas sin Mercado Pago ni base de datos (ver pricing.test.js).

// Costo fijo de envío a domicilio. Se suma como un item más de la preferencia
// para que Mercado Pago cobre el total correcto (subtotal + envío).
export const DELIVERY_FEE = 2000;

// A partir de este monto (sin contar el envío) el delivery sale gratis.
// Tiene que coincidir con FREE_SHIPPING_THRESHOLD en el frontend
// (constants/deliveryZones.js): ahí solo se le muestra al usuario, acá es
// donde se decide de verdad si se cobra o no.
export const FREE_SHIPPING_THRESHOLD = 15000;

// 10% OFF en toda la tienda para cuentas registradas (ver auth/), en toda
// compra hecha con sesión iniciada. Tiene que coincidir con
// ACCOUNT_DISCOUNT_RATE en el frontend (utils/discount.js): ahí solo se le
// muestra al usuario, acá es donde se cobra el monto real con descuento.
export const ACCOUNT_DISCOUNT_RATE = 0.1;

export const MAX_QUANTITY = 100;

// Arma el carrito a cobrar a partir de lo que manda el navegador. Título,
// precio y foto salen de la base ("getProduct"), no del navegador: si no,
// cualquiera podía editar el carrito guardado en localStorage y pagar el
// precio que quisiera. Del carrito solo se usan el id y la cantidad.
// Devuelve { cartList } o { error } con un mensaje para el usuario.
export const armarCarrito = (rawCartList, getProduct) => {
  if (!Array.isArray(rawCartList) || rawCartList.length === 0) {
    return { error: "El carrito está vacío" };
  }

  const cartList = [];
  for (const item of rawCartList) {
    const product = getProduct(item?.id);
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return {
        error: "Hay un producto del carrito que ya no está disponible. Revisá tu pedido.",
      };
    }
    cartList.push({
      id: String(product.id),
      title: product.title,
      price: product.price,
      quantity,
      images: product.image ? [product.image] : [],
    });
  }
  return { cartList };
};

// Items de la preferencia de Mercado Pago (con descuento si corresponde, y
// el envío como un item más) y las fotos en el mismo orden, que se guardan
// en metadata (ver payment.controller.js).
export const armarItems = ({ cartList, conDescuento, deliveryType }) => {
  const items = cartList.map((product) => ({
    title: product.title,
    currency_id: "ARS",
    unit_price: conDescuento
      ? Math.round(product.price * (1 - ACCOUNT_DISCOUNT_RATE))
      : product.price,
    quantity: product.quantity,
    picture_url: product.images?.[0] || "",
  }));
  const productImages = cartList.map((product) => product.images?.[0] || "");

  // El mínimo para envío gratis se mide sobre el subtotal SIN descuento,
  // igual que en el frontend.
  const subtotal = cartList.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0
  );
  const envioGratis = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (deliveryType === "delivery" && !envioGratis) {
    items.push({
      title: "Costo de envío",
      currency_id: "ARS",
      unit_price: DELIVERY_FEE,
      quantity: 1,
    });
    productImages.push("");
  }

  return { items, productImages };
};
