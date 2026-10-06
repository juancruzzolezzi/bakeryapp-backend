// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codigoPedido,
  enmascararContacto,
  esEstadoDelLocal,
  esTokenValido,
  aIso,
  pedidoPublico,
  pedidoParaElLocal,
} from "./estados.js";

test("el código del pedido tiene 4 dígitos como mínimo", () => {
  assert.equal(codigoPedido(7), "BK-0007");
  assert.equal(codigoPedido(142), "BK-0142");
  assert.equal(codigoPedido(12345), "BK-12345");
});

test("solo acepta tokens de 32 caracteres hexadecimales", () => {
  assert.ok(esTokenValido("0123456789abcdef0123456789abcdef"));
  assert.ok(!esTokenValido("0123456789ABCDEF0123456789ABCDEF"));
  assert.ok(!esTokenValido("123"));
  assert.ok(!esTokenValido("../../etc/passwd"));
  assert.ok(!esTokenValido(undefined));
});

test("el local no puede devolver un pedido a pendiente de pago", () => {
  assert.ok(esEstadoDelLocal("preparacion"));
  assert.ok(esEstadoDelLocal("entregado"));
  assert.ok(!esEstadoDelLocal("pendiente_pago"));
  assert.ok(!esEstadoDelLocal("cualquiera"));
});

test("el contacto se muestra a medias en la página pública", () => {
  assert.equal(enmascararContacto("+54 9 11 5555-4821", "whatsapp"), "•••• 4821");
  assert.equal(enmascararContacto("@lucia.panaderia", "instagram"), "@lu•••");
  assert.equal(enmascararContacto("", "whatsapp"), "");
  assert.equal(enmascararContacto("12", "whatsapp"), "••••");
});

test("las fechas de SQLite pasan a ISO en UTC", () => {
  assert.equal(aIso("2026-10-06 17:05:00"), "2026-10-06T17:05:00Z");
  assert.equal(aIso(null), null);
});

const fila = {
  id: 142,
  token: "0123456789abcdef0123456789abcdef",
  status: "camino",
  items: JSON.stringify([{ id: "1", title: "Cookies de Chocolate", quantity: 2, unit_price: 5000 }]),
  subtotal: 10000,
  discount: 0,
  shipping: 2000,
  total: 12000,
  delivery_type: "delivery",
  address: "Cabildo 2040",
  contact: "1155554821",
  contact_method: "whatsapp",
  created_at: "2026-10-06 17:05:00",
  paid_at: "2026-10-06 17:06:00",
};

test("la versión pública oculta el contacto y la del local no", () => {
  const publico = pedidoPublico(fila);
  assert.equal(publico.code, "BK-0142");
  assert.equal(publico.contact, "•••• 4821");
  assert.equal(publico.items.length, 1);
  assert.equal(publico.id, undefined);
  assert.equal(pedidoParaElLocal(fila).contact, "1155554821");
});

test("items rotos en la base no rompen la respuesta", () => {
  assert.deepEqual(pedidoPublico({ ...fila, items: "{roto" }).items, []);
});
