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

// Seed con datos de ejemplo si las tablas están vacías
const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;

if (productCount === 0) {
  const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const insertProduct = db.prepare(
    "INSERT INTO products (title, description, price, category, image) VALUES (?, ?, ?, ?, ?)"
  );

  const categories = ["Facturas", "Tortas", "Cookies", "Trufas"];
  categories.forEach((name) => insertCategory.run(name));

  const products = [
    ["Cookies de Chocolate", "Cookies caseras con chips de chocolate", 2000, "Cookies", "https://picsum.photos/seed/cookies1/400/300"],
    ["Torta de Chocolate", "Torta húmeda de chocolate con ganache", 13000, "Tortas", "https://picsum.photos/seed/torta1/400/300"],
    ["Medialunas de Manteca", "Docena de medialunas artesanales", 10000, "Facturas", "https://picsum.photos/seed/facturas1/400/300"],
    ["Trufas de Chocolate", "Caja x6 trufas artesanales", 8000, "Trufas", "https://picsum.photos/seed/trufas1/400/300"],
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

const nuevasCategorias = ["Sin TACC", "Vegano"];
nuevasCategorias.forEach((name) => insertCategoryIfMissing.run(name));

const nuevosProductos = [
  ["Alfajores de Maicena", "Docena de alfajores rellenos de dulce de leche", 10000, "Cookies", "http://localhost:3000/uploads/alfajores.jpg"],
  ["Brownies con Nueces", "Bandeja x6 brownies húmedos con nueces", 6000, "Tortas", "http://localhost:3000/uploads/brownie.webp"],
  ["Cookies de Avena y Pasas", "Docena de cookies caseras de avena y pasas de uva", 12000, "Cookies", "http://localhost:3000/uploads/cookiesavenaypasas.jpg"],
  ["Torta Red Velvet", "Torta red velvet con frosting de queso crema", 15000, "Tortas", "http://localhost:3000/uploads/tortaredvelvet.jpg"],
  ["Cheesecake de Frutos Rojos", "Cheesecake horneado con coulis de frutos rojos", 15000, "Tortas", "http://localhost:3000/uploads/CHEESECAKE-CON-FRUTOS-ROJOS.webp"],
  ["Facturas Surtidas", "Docena surtida de facturas (medialunas, vigilantes, cañoncitos)", 12000, "Facturas", "http://localhost:3000/uploads/docenasurtida.jpg"],
  ["Media Docena Surtida", "Media docena surtida de facturas (medialunas, vigilantes y cañoncitos)", 7000, "Facturas", "http://localhost:3000/uploads/mediadocenasurtida.jpg"],
  ["Trufas de Maracuyá", "Caja x6 trufas artesanales de maracuyá", 8000, "Trufas", "http://localhost:3000/uploads/trufamaracuya.jpg"],

  // Sección Sin TACC
  ["Cookies de Chocolate Sin TACC", "Docena de cookies sin gluten con chips de chocolate", 15000, "Sin TACC", "http://localhost:3000/uploads/cookiesintacc.jpg"],
  ["Brownies Sin TACC", "Bandeja x6 brownies sin gluten con harina de almendras", 8000, "Sin TACC", "http://localhost:3000/uploads/browniesingluten.jpg"],
  ["Torta de Zanahoria Sin TACC", "Torta de zanahoria sin gluten con glaseado de queso crema", 16000, "Sin TACC", "http://localhost:3000/uploads/tartazanahoriasingluten.jpg"],
  ["Facturas Sin TACC", "Docena de facturas sin gluten (medialunas y vigilantes)", 16000, "Sin TACC", "http://localhost:3000/uploads/facturassingluten.jpg"],

  // Sección Vegana
  ["Cookies Veganas de Chocolate", "Docena de cookies veganas con chips de chocolate", 14000, "Vegano", "http://localhost:3000/uploads/cookievegana.jpg"],
  ["Torta Vegana de Manzana y Canela", "Torta vegana de manzana y canela, sin huevo ni lácteos", 15000, "Vegano", "http://localhost:3000/uploads/tartamanzanavegana.png"],
  ["Brownies Veganos", "Bandeja x6 brownies veganos con cacao intenso", 7500, "Vegano", "http://localhost:3000/uploads/brownievegano.jpg"],
  ["Trufas Veganas de Coco", "Caja x6 trufas veganas de coco y chocolate", 9000, "Vegano", "http://localhost:3000/uploads/trufasveganascoco.jpg"],
];

nuevosProductos.forEach(([title, description, price, category, image]) => {
  if (!productExists.get(title)) {
    insertProductIfMissing.run(title, description, price, category, image);
  }
});
