import { Router } from "express";
import { db } from "./db.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// Los statements se preparan UNA sola vez acá arriba (no adentro de cada
// handler): better-sqlite3 recomienda "preparar una vez, ejecutar muchas",
// y /products en particular se pide en cada visita a la página.
const selectAllProducts = db.prepare("SELECT * FROM products");
const selectProductById = db.prepare("SELECT * FROM products WHERE id = ?");
const selectAllCategoryNames = db.prepare("SELECT name FROM categories");
const insertProduct = db.prepare(
  "INSERT INTO products (title, description, price, category, image) VALUES (?, ?, ?, ?, ?)"
);
const updateProduct = db.prepare(
  "UPDATE products SET title = ?, description = ?, price = ?, category = ?, image = ? WHERE id = ?"
);
const deleteProduct = db.prepare("DELETE FROM products WHERE id = ?");

// GET /products
router.get("/products", (req, res) => {
  const rows = selectAllProducts.all();
  const products = rows.map((p) => ({
    id: String(p.id),
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    images: p.image ? [p.image] : [],
    sold: p.sold ?? 0,
  }));
  res.json(products);
});

// GET /categories
router.get("/categories", (req, res) => {
  const rows = selectAllCategoryNames.all();
  res.json(rows.map((r) => r.name));
});

// Valida un producto completo antes de guardarlo. Devuelve el mensaje de
// error, o null si está todo bien.
const validarProducto = ({ title, description, price, category, image }) => {
  if (typeof title !== "string" || !title.trim()) return "title es requerido";
  if (typeof category !== "string" || !category.trim()) return "category es requerido";
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return "price tiene que ser un número mayor a 0";
  }
  if (description != null && typeof description !== "string") return "description tiene que ser texto";
  if (image != null && typeof image !== "string") return "image tiene que ser texto";
  return null;
};

// POST /products (solo admin, ver middleware/requireAdmin.js)
router.post("/products", requireAdmin, (req, res) => {
  const { title, description, price, category, image } = req.body;
  const error = validarProducto(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const result = insertProduct.run(title.trim(), description ?? "", price, category.trim(), image ?? "");
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /products/:id (solo admin). Se pueden mandar solo los campos que
// cambian: el resto queda como estaba (antes, un campo que no venía se
// guardaba vacío).
router.put("/products/:id", requireAdmin, (req, res) => {
  const actual = selectProductById.get(req.params.id);
  if (!actual) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }
  const pick = (campo) => (req.body[campo] !== undefined ? req.body[campo] : actual[campo]);
  const producto = {
    title: pick("title"),
    description: pick("description"),
    price: pick("price"),
    category: pick("category"),
    image: pick("image"),
  };
  const error = validarProducto(producto);
  if (error) {
    return res.status(400).json({ error });
  }
  updateProduct.run(
    producto.title.trim(),
    producto.description ?? "",
    producto.price,
    producto.category.trim(),
    producto.image ?? "",
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /products/:id (solo admin)
router.delete("/products/:id", requireAdmin, (req, res) => {
  const { changes } = deleteProduct.run(req.params.id);
  if (changes === 0) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }
  res.json({ ok: true });
});

export default router;
