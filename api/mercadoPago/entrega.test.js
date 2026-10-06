// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { describirEntrega, fechaArgentina, requiereEncargo, validarEntrega } from "./entrega.js";

// Martes 6 de octubre de 2026, 15:40 en Argentina.
const MARTES = new Date("2026-10-06T18:40:00Z");

test("solo las tortas enteras se hornean por encargo", () => {
  assert.ok(requiereEncargo("Torta Red Velvet", "Torta red velvet con frosting de queso crema"));
  assert.ok(requiereEncargo("Torta de Zanahoria Sin TACC", "Torta entera, 12 porciones"));
  assert.ok(requiereEncargo("Cheesecake de Frutos Rojos", ""));
  assert.ok(!requiereEncargo("Torta Red Velvet", "Torta red velvet con frosting de queso crema (por porción)"));
  assert.ok(!requiereEncargo("Cheesecake de Maracuyá", "Cheesecake de maracuyá (Por Porcion)"));
  assert.ok(!requiereEncargo("Brownie con Nueces", "Brownie húmedo con nueces"));
  assert.ok(!requiereEncargo("Cookies de Chocolate", ""));
  assert.ok(!requiereEncargo("", ""));
});

test("la fecha de hoy se toma en hora de Argentina", () => {
  assert.equal(fechaArgentina(MARTES), "2026-10-06");
  // 22 hs del martes en Argentina ya es miércoles en UTC.
  assert.equal(fechaArgentina(new Date("2026-10-07T01:00:00Z")), "2026-10-06");
});

test("un frontend viejo, sin el dato, no se valida", () => {
  assert.deepEqual(validarEntrega({ hayEncargo: true, ahora: MARTES }), { entrega: null });
});

test("cuanto antes: sí sin torta, no con torta", () => {
  assert.deepEqual(validarEntrega({ cuando: "asap", hayEncargo: false, ahora: MARTES }).entrega, { cuando: "asap", fecha: "" });
  assert.ok(validarEntrega({ cuando: "asap", hayEncargo: true, ahora: MARTES }).error);
});

test("programado: desde mañana, o desde pasado mañana con torta", () => {
  const sin = (fecha) => validarEntrega({ cuando: "programado", fecha, hayEncargo: false, ahora: MARTES });
  const con = (fecha) => validarEntrega({ cuando: "programado", fecha, hayEncargo: true, ahora: MARTES });
  assert.ok(sin("2026-10-06").error, "hoy");
  assert.equal(sin("2026-10-07").entrega.fecha, "2026-10-07");
  assert.ok(con("2026-10-07").error, "miércoles con torta");
  assert.equal(con("2026-10-08").entrega.fecha, "2026-10-08");
});

test("programado: a las 22 hs del martes, el miércoles sigue siendo mañana", () => {
  const r = validarEntrega({ cuando: "programado", fecha: "2026-10-07", hayEncargo: false, ahora: new Date("2026-10-07T01:00:00Z") });
  assert.equal(r.entrega.fecha, "2026-10-07");
});

test("programado: rechaza domingos, fechas inválidas y más de 30 días", () => {
  const v = (fecha) => validarEntrega({ cuando: "programado", fecha, hayEncargo: false, ahora: MARTES });
  assert.ok(v("2026-10-11").error, "domingo");
  assert.ok(v("2026-02-30").error, "no existe");
  assert.ok(v("8/10").error, "formato");
  assert.ok(v(undefined).error, "sin fecha");
  assert.ok(v("2026-11-30").error, "más de 30 días");
  assert.ok(validarEntrega({ cuando: "mañana", ahora: MARTES }).error, "valor desconocido");
});

test("texto para los mails", () => {
  assert.equal(describirEntrega("asap", ""), "Cuanto antes");
  assert.equal(describirEntrega("programado", "2026-10-08"), "Jueves 8 de octubre (horario a coordinar por WhatsApp)");
  assert.equal(describirEntrega("", ""), "");
});
