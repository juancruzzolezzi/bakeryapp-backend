import { Router } from "express";
import { db } from "./db.js";

const router = Router();

// Los statements se preparan UNA sola vez acá arriba (no adentro de cada
// handler): better-sqlite3 recomienda "preparar una vez, ejecutar muchas",
// y /products en particular se pide en cada visita a la página.
const selectAllProducts = db.prepare("SELECT * FROM products");
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
  }));
  res.json(products);
});

// GET /categories
router.get("/categories", (req, res) => {
  const rows = selectAllCategoryNames.all();
  res.json(rows.map((r) => r.name));
});

// POST /products
router.post("/products", (req, res) => {
  const { title, description, price, category, image } = req.body;
  if (!title || !price || !category) {
    return res.status(400).json({ error: "title, price y category son requeridos" });
  }
  const result = insertProduct.run(title, description ?? "", price, category, image ?? "");
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /products/:id
router.put("/products/:id", (req, res) => {
  const { title, description, price, category, image } = req.body;
  updateProduct.run(title, description, price, category, image, req.params.id);
  res.json({ ok: true });
});

// DELETE /products/:id
router.delete("/products/:id", (req, res) => {
  deleteProduct.run(req.params.id);
  res.json({ ok: true });
});

export default router;
