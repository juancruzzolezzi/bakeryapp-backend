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
    ["Cookies de Chocolate", "Cookies caseras con chips de chocolate", 1500, "Cookies", "https://picsum.photos/seed/cookies1/400/300"],
    ["Torta de Chocolate", "Torta húmeda de chocolate con ganache", 8500, "Tortas", "https://picsum.photos/seed/torta1/400/300"],
    ["Medialunas de Manteca", "Docena de medialunas artesanales", 3200, "Facturas", "https://picsum.photos/seed/facturas1/400/300"],
    ["Trufas de Chocolate", "Caja x6 trufas artesanales", 2800, "Trufas", "https://picsum.photos/seed/trufas1/400/300"],
  ];
  products.forEach((p) => insertProduct.run(...p));

  console.log("Base de datos inicializada con datos de ejemplo");
}
