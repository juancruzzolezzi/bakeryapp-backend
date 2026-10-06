import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth } from "../auth/src/middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  COLUMNA_HORA,
  esEstadoDelLocal,
  esTokenValido,
  pedidoParaElLocal,
  pedidoPublico,
} from "./estados.js";

const router = Router();

const selectByToken = db.prepare("SELECT * FROM orders WHERE token = ?");
const selectById = db.prepare("SELECT * FROM orders WHERE id = ?");
const selectMine = db.prepare(`
  SELECT * FROM orders
  WHERE user_id = ? AND status != 'pendiente_pago'
  ORDER BY id DESC
  LIMIT 30
`);
// Panel del local: todo lo que está en curso, más lo entregado hoy (hora
// de Argentina, UTC-3; el servidor guarda en UTC).
const selectParaElLocal = db.prepare(`
  SELECT * FROM orders
  WHERE status IN ('recibido', 'preparacion', 'camino')
     OR (status = 'entregado' AND date(delivered_at, '-3 hours') = date('now', '-3 hours'))
  ORDER BY id DESC
`);
// Un UPDATE por columna de hora: el nombre de la columna no puede ir como
// parámetro "?", así que se arman de antemano a partir de COLUMNA_HORA. La
// hora de cada paso se guarda la primera vez y no se pisa si el local
// vuelve un paso atrás y adelante de nuevo.
const updateEstado = Object.fromEntries(
  Object.entries(COLUMNA_HORA).map(([estado, columna]) => [
    estado,
    db.prepare(
      `UPDATE orders SET status = ?, ${columna} = COALESCE(${columna}, datetime('now'))
       WHERE id = ? AND status != 'pendiente_pago'`
    ),
  ])
);

// GET /orders/track/:token — página de seguimiento. Pública: el token del
// link es lo que la protege (128 bits al azar, no se puede adivinar).
router.get("/orders/track/:token", (req, res) => {
  if (!esTokenValido(req.params.token)) {
    return res.status(404).json({ error: "No encontramos ese pedido" });
  }
  const row = selectByToken.get(req.params.token);
  if (!row) {
    return res.status(404).json({ error: "No encontramos ese pedido" });
  }
  res.json({ order: pedidoPublico(row) });
});

// GET /orders/mine — "Mis pedidos" de la cuenta con sesión iniciada.
router.get("/orders/mine", requireAuth, (req, res) => {
  res.json({ orders: selectMine.all(req.userId).map(pedidoPublico) });
});

// GET /admin/orders — panel del local (header x-admin-key).
router.get("/admin/orders", requireAdmin, (req, res) => {
  res.json({ orders: selectParaElLocal.all().map(pedidoParaElLocal) });
});

// PATCH /admin/orders/:id/status — el local cambia el estado de un pedido.
router.patch("/admin/orders/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!esEstadoDelLocal(status)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  const { changes } = updateEstado[status].run(status, req.params.id);
  if (changes === 0) {
    return res.status(404).json({ error: "No encontramos ese pedido, o todavía no está pagado" });
  }
  res.json({ order: pedidoParaElLocal(selectById.get(req.params.id)) });
});

export default router;
