// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  armarCarrito,
  armarItems,
  DELIVERY_FEE,
  FREE_SHIPPING_THRESHOLD,
} from "./pricing.js";

const CATALOGO = {
  1: { id: 1, title: "Medialunas", price: 10000, image: "medialunas.jpg" },
  2: { id: 2, title: "Cookie", price: 2500, image: "" },
};
const getProduct = (id) => CATALOGO[id];

const total = (items) => items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

test("el precio sale del catálogo, no de lo que manda el navegador", () => {
  const { cartList } = armarCarrito([{ id: "1", quantity: 2, price: 1 }], getProduct);
  assert.equal(cartList[0].price, 10000);
  assert.deepEqual(cartList[0].images, ["medialunas.jpg"]);
});

test("rechaza carrito vacío, productos inexistentes y cantidades inválidas", () => {
  assert.ok(armarCarrito([], getProduct).error);
  assert.ok(armarCarrito(null, getProduct).error);
  assert.ok(armarCarrito([{ id: "99", quantity: 1 }], getProduct).error);
  for (const quantity of [0, -1, 1.5, 101, "abc"]) {
    assert.ok(armarCarrito([{ id: "1", quantity }], getProduct).error, `quantity ${quantity}`);
  }
});

test("take away no suma envío", () => {
  const { cartList } = armarCarrito([{ id: "2", quantity: 1 }], getProduct);
  const { items } = armarItems({ cartList, conDescuento: false, deliveryType: "takeaway" });
  assert.equal(total(items), 2500);
});

test("delivery por debajo del mínimo suma el envío", () => {
  const { cartList } = armarCarrito([{ id: "2", quantity: 2 }], getProduct);
  const { items, productImages } = armarItems({ cartList, conDescuento: false, deliveryType: "delivery" });
  assert.equal(total(items), 5000 + DELIVERY_FEE);
  assert.equal(items.at(-1).title, "Costo de envío");
  assert.equal(productImages.length, items.length);
});

test("delivery justo en el mínimo sale gratis", () => {
  const { cartList } = armarCarrito([{ id: "2", quantity: FREE_SHIPPING_THRESHOLD / 2500 }], getProduct);
  const { items } = armarItems({ cartList, conDescuento: false, deliveryType: "delivery" });
  assert.equal(total(items), FREE_SHIPPING_THRESHOLD);
});

test("el mínimo para envío gratis se mide sin descuento", () => {
  // 15.000 de subtotal, 13.500 con descuento: igual sale gratis.
  const { cartList } = armarCarrito([{ id: "2", quantity: 6 }], getProduct);
  const { items } = armarItems({ cartList, conDescuento: true, deliveryType: "delivery" });
  assert.equal(total(items), 13500);
});

test("con cuenta se aplica 10% por unidad, redondeado", () => {
  const { cartList } = armarCarrito([{ id: "1", quantity: 1 }, { id: "2", quantity: 3 }], getProduct);
  const { items } = armarItems({ cartList, conDescuento: true, deliveryType: "takeaway" });
  assert.equal(items[0].unit_price, 9000);
  assert.equal(items[1].unit_price, 2250);
  assert.equal(total(items), 9000 + 2250 * 3);
});
