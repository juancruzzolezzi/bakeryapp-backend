import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "bakery.db");

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Login con Google: guardamos el "sub" (id estable de Google) para poder
// reconocer al usuario aunque cambie el nombre. Las cuentas creadas por
// Google no tienen contraseña, así que password_hash queda como "".
// ALTER idempotente: si la columna ya existe, SQLite tira error y lo
// ignoramos.
try {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
} catch {
  /* la columna ya existe */
}

// Seed con datos de ejemplo si las tablas están vacías
const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;

if (productCount === 0) {
  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const insertProduct = db.prepare(
    "INSERT INTO products (title, description, price, category, image) VALUES (?, ?, ?, ?, ?)"
  );

  const categories = ["Facturas", "Tortas", "Cookies", "Alfajores"];
  categories.forEach((name) => insertCategory.run(name));

  const products = [
    ["Cookies de Chocolate", "Cookies caseras con chips de chocolate (por unidad)", 2000, "Cookies", "https://bakeryapp-backend-80a2.onrender.com/uploads/cookie.jpg"],
    ["Torta de Chocolate", "Torta húmeda de chocolate con ganache", 13000, "Tortas", "https://picsum.photos/seed/torta1/400/300"],
    ["Medialunas de Manteca", "Docena de medialunas artesanales", 10000, "Facturas", "https://picsum.photos/seed/facturas1/400/300"],
    ["Alfajor de Maicena", "Pack x6 alfajores de maicena con dulce de leche y coco rallado", 9000, "Alfajores", "https://bakeryapp-backend-80a2.onrender.com/uploads/alfajores-maicena.webp"],
  ];
  products.forEach((p) => insertProduct.run(...p));

  console.log("Base de datos inicializada con datos de ejemplo");
}

// Ampliación de catálogo: más variedad + sección para celíacos y veganos.
// Se ejecuta siempre, pero es idempotente (no duplica si ya existen).
const insertCategoryIfMissing = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
const productExists = db.prepare("SELECT 1 FROM products WHERE title = ?");
const insertProductIfMissing = db.prepare(
  "INSERT INTO products (title, description, price, category, image) VALUES (?, ?, ?, ?, ?)"
);

// La categoría se renombró de "Alfajor" a "Alfajores": hay que renombrarla
// ANTES de insertar "Alfajores" como categoría nueva, porque el UPDATE
// choca con la constraint UNIQUE si la fila "Alfajores" ya existe.
db.prepare("UPDATE OR IGNORE categories SET name = 'Alfajores' WHERE name = 'Alfajor'").run();
db.prepare("DELETE FROM categories WHERE name = 'Alfajor'").run();
db.prepare("UPDATE products SET category = 'Alfajores' WHERE category = 'Alfajor'").run();

const nuevasCategorias = ["Sin TACC", "Vegano", "Alfajores"];
nuevasCategorias.forEach((name) => insertCategoryIfMissing.run(name));

// Nota: estos títulos deben coincidir siempre con los títulos actuales en
// products (ver PUT /products/:id). Si se renombra un producto ya
// sembrado, hay que actualizar el título acá también; si no, este seed
// idempotente-por-título no lo va a reconocer como existente y lo va a
// volver a insertar duplicado en cada redeploy.
const nuevosProductos = [
  ["Brownie con Nueces", "Brownie húmedo con nueces (por unidad)", 2500, "Tortas", "https://bakeryapp-backend-80a2.onrender.com/uploads/brownieconnueces.jpg"],
  ["Cookie de Avena y Pasas", "Cookie casera de avena y pasas de uva (por unidad)", 3000, "Cookies", "https://bakeryapp-backend-80a2.onrender.com/uploads/cookiesavenaypasas.jpg"],
  ["Torta Red Velvet", "Torta red velvet con frosting de queso crema", 15000, "Tortas", "https://bakeryapp-backend-80a2.onrender.com/uploads/tortaredvelvet.jpg"],
  ["Cheesecake de Frutos Rojos", "Cheesecake horneado con coulis de frutos rojos", 15000, "Tortas", "https://bakeryapp-backend-80a2.onrender.com/uploads/CHEESECAKE-CON-FRUTOS-ROJOS.jpg"],
  ["Facturas Surtidas", "Docena surtida de facturas", 15000, "Facturas", "https://bakeryapp-backend-80a2.onrender.com/uploads/docenasurtida.jpg"],
  ["Media Docena Surtida", "Media docena surtida de facturas (medialunas, vigilantes y cañoncitos)", 9000, "Facturas", "https://bakeryapp-backend-80a2.onrender.com/uploads/mediadocenasurtida.jpg"],

  // Sección Alfajores
  ["Alfajor de Dulce de Leche", "Bañado en chocolate, relleno de dulce de leche (por unidad)", 2500, "Alfajores", "https://bakeryapp-backend-80a2.onrender.com/uploads/alfajores.jpg"],
  ["Alfajor de Fruta", "Bañado en chocolate blanco, relleno de dulce de frutos rojos (por unidad)", 2500, "Alfajores", "https://bakeryapp-backend-80a2.onrender.com/uploads/alfajorfruta.jpg"],

  // Sección Sin TACC
  ["Cookie de Chocolate Sin TACC", "Cookie sin gluten con chips de chocolate (por unidad)", 4000, "Sin TACC", "https://bakeryapp-backend-80a2.onrender.com/uploads/cookiesintacc.jpg"],
  ["Brownie Sin TACC", "Brownie sin gluten con harina de almendras (por unidad)", 3000, "Sin TACC", "https://bakeryapp-backend-80a2.onrender.com/uploads/browniesingluten.jpg"],
  ["Torta de Zanahoria Sin TACC", "Torta de zanahoria sin gluten con glaseado de queso crema", 16000, "Sin TACC", "https://bakeryapp-backend-80a2.onrender.com/uploads/tartazanahoriasingluten.jpg"],
  ["Medialunas Sin TACC", "Docena de medialunas sin gluten", 16000, "Sin TACC", "https://bakeryapp-backend-80a2.onrender.com/uploads/facturassingluten.jpg"],

  // Sección Vegana
  ["Cookie Vegana de Chocolate", "Cookie vegana con chips de chocolate (por unidad)", 3000, "Vegano", "https://bakeryapp-backend-80a2.onrender.com/uploads/cookievegana.jpg"],
  ["Torta Vegana de Manzana y Canela", "Torta vegana de manzana y canela, sin huevo ni lácteos", 15000, "Vegano", "https://bakeryapp-backend-80a2.onrender.com/uploads/tartamanzanavegana.jpg"],
  ["Brownie Vegano", "Brownie vegano con cacao intenso (por unidad)", 3000, "Vegano", "https://bakeryapp-backend-80a2.onrender.com/uploads/brownievegano.jpg"],
  ["Trufas Veganas de Coco", "Caja x6 trufas veganas de coco y chocolate", 9000, "Vegano", "https://bakeryapp-backend-80a2.onrender.com/uploads/trufasveganascoco.jpg"],
];

nuevosProductos.forEach(([title, description, price, category, image]) => {
  if (!productExists.get(title)) {
    insertProductIfMissing.run(title, description, price, category, image);
  }
});
