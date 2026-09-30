import { Router } from "express";
import crypto from "crypto";
import { db } from "../db/db.js";
import { sendViaMailjet } from "../nodemailer/src/controllers/nodemailer.controllers.js";
import { ipRateLimit } from "../middleware/rateLimit.js";

// Botón de arrepentimiento (Res. 424/2020 de la Secretaría de Comercio
// Interior): el cliente pide revocar una compra hecha a distancia y el
// local tiene que darle un código de identificación de la solicitud. Se
// guarda en la base (para tener constancia) y se avisa por mail al local
// y al cliente, con ese código.

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    pedido TEXT,
    fecha_pedido TEXT,
    motivo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertRequest = db.prepare(`
  INSERT INTO withdrawal_requests (code, nombre, email, telefono, pedido, fecha_pedido, motivo)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Todo lo que escribe el cliente va adentro del HTML del mail.
const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

const recortar = (value, max) => String(value ?? "").trim().slice(0, max);

const generarCodigo = () => {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sufijo = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ARR-${fecha}-${sufijo}`;
};

const filasHtml = (datos) =>
  datos
    .filter(([, valor]) => valor)
    .map(
      ([label, valor]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${label}</td><td style="padding:4px 0"><strong>${escapeHtml(
          valor
        )}</strong></td></tr>`
    )
    .join("");

router.post(
  "/arrepentimiento",
  ipRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Recibimos varias solicitudes seguidas. Probá de nuevo en un rato o escribinos por WhatsApp.",
  }),
  async (req, res) => {
    const nombre = recortar(req.body?.nombre, 120);
    const email = recortar(req.body?.email, 160).toLowerCase();
    const telefono = recortar(req.body?.telefono, 40);
    const pedido = recortar(req.body?.pedido, 80);
    const fechaPedido = recortar(req.body?.fechaPedido, 20);
    const motivo = recortar(req.body?.motivo, 1000);

    if (!nombre || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Completá tu nombre y un email válido." });
    }

    const code = generarCodigo();

    try {
      insertRequest.run(code, nombre, email, telefono, pedido, fechaPedido, motivo);
    } catch (error) {
      console.error("No se pudo guardar la solicitud de arrepentimiento:", error);
      return res.status(500).json({ error: "No pudimos registrar tu solicitud. Probá de nuevo." });
    }

    const detalle = filasHtml([
      ["Código", code],
      ["Nombre", nombre],
      ["Email", email],
      ["Teléfono", telefono],
      ["N° de pedido / pago", pedido],
      ["Fecha del pedido", fechaPedido],
      ["Motivo", motivo],
    ]);

    const shopOwnerEmail = process.env.SHOP_OWNER_EMAIL || process.env.EMAIL_USER;

    // Si el mail falla, la solicitud igual quedó registrada con su código:
    // se le devuelve al cliente para que lo guarde.
    const envios = [
      sendViaMailjet({
        to: email,
        subject: `Recibimos tu solicitud de arrepentimiento (${code})`,
        html: `<div style="font-family:sans-serif">
          <p>Hola ${escapeHtml(nombre)}, recibimos tu solicitud para revocar tu compra en Bakery.</p>
          <p>Tu código de identificación es <strong>${code}</strong>. Guardalo para cualquier consulta.</p>
          <p>Nos vamos a comunicar con vos para coordinar la devolución del dinero.</p>
          <table>${detalle}</table>
        </div>`,
      }),
    ];
    if (shopOwnerEmail) {
      envios.push(
        sendViaMailjet({
          to: shopOwnerEmail,
          subject: `Solicitud de arrepentimiento ${code}`,
          html: `<div style="font-family:sans-serif">
            <p>Un cliente usó el botón de arrepentimiento. Hay que responderle y gestionar la devolución.</p>
            <table>${detalle}</table>
          </div>`,
        })
      );
    }

    const resultados = await Promise.allSettled(envios);
    resultados.forEach((r) => {
      if (r.status === "rejected") {
        console.error("Error al enviar mail de arrepentimiento:", r.reason?.message);
      }
    });

    res.status(201).json({ code, emailSent: resultados[0].status === "fulfilled" });
  }
);

export default router;
