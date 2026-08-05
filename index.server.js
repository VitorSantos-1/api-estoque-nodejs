import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * CORS:
 * - CORS_ORIGIN="*" permite tudo (dev)
 * - CORS_ORIGIN="http://localhost:5500,http://127.0.0.1:5500" para restringir
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const corsOrigin =
  CORS_ORIGIN === "*"
    ? "*"
    : CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: corsOrigin,
  })
);

// Conexão com o Banco
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "products_db",
  decimalNumbers: true,
  connectionLimit: 10,
});

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseSpecs(specs) {
  if (specs == null) return {};
  if (typeof specs === "object") return specs;
  if (typeof specs === "string") {
    const s = specs.trim();
    if (!s) return {};
    try {
      return JSON.parse(s);
    } catch {
      // Se o front mandar string qualquer, não quebra o backend
      return { raw: s };
    }
  }
  return {};
}

/** Normaliza JSON que pode voltar como string */
function normalizeRow(row) {
  if (!row) return row;
  if (typeof row.specs === "string") {
    try {
      row.specs = JSON.parse(row.specs);
    } catch {
      row.specs = {};
    }
  }
  return row;
}

/*********************
 * HEALTH
 *********************/
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "falconsstock-api" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/*********************
 * SETTINGS
 *********************/
app.get("/api/settings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM settings WHERE id=1 LIMIT 1");
    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const body = req.body || {};
    const company_name = body.company_name ?? null;
    const email = body.email ?? null;
    const phone = body.phone ?? null;
    const address = body.address ?? null;
    const low_stock_alert = Math.max(toInt(body.low_stock_alert, 10), 0);

    await pool.query(
      `
      INSERT INTO settings (id, company_name, email, phone, address, low_stock_alert)
      VALUES (1, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        company_name=VALUES(company_name),
        email=VALUES(email),
        phone=VALUES(phone),
        address=VALUES(address),
        low_stock_alert=VALUES(low_stock_alert)
      `,
      [company_name, email, phone, address, low_stock_alert]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/*********************
 * DASHBOARD (KPIs)
 *********************/
app.get("/api/dashboard", async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(price * quantity), 0) AS stock_value,
        COUNT(DISTINCT brand) AS total_brands,
        COUNT(DISTINCT category) AS total_categories
      FROM products
      WHERE status='ATIVO'
    `);

    const [low] = await pool.query(`
      SELECT COUNT(*) AS low_stock_count
      FROM products p
      CROSS JOIN (SELECT COALESCE((SELECT low_stock_alert FROM settings WHERE id=1), 10) AS alert) s
      WHERE p.status='ATIVO'
        AND p.quantity < (CASE WHEN COALESCE(p.min_stock,0) > 0 THEN p.min_stock ELSE s.alert END)
    `);

    res.json({
      totalProducts: stats[0]?.total_products || 0,
      stockValue: stats[0]?.stock_value || 0,
      totalBrands: stats[0]?.total_brands || 0,
      totalCategories: stats[0]?.total_categories || 0,
      lowStockCount: low[0]?.low_stock_count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*********************
 * PRODUCTS
 *********************/
app.get("/api/products", async (req, res) => {
  const { search, limit, offset, includeInactive } = req.query;

  const lim = Math.min(Math.max(toInt(limit, 100), 1), 1000);
  const off = Math.max(toInt(offset, 0), 0);

  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (!includeInactive || includeInactive === "0") {
    sql += " AND status = 'ATIVO'";
  }

  if (search) {
    sql += " AND (barcode LIKE ? OR name LIKE ? OR brand LIKE ? OR category LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(lim, off);

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeRow));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Produto não encontrado" });
    res.json(normalizeRow(rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.barcode || !String(p.barcode).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: barcode" });
    }
    if (!p.name || !String(p.name).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: name" });
    }

    const specsObj = parseSpecs(p.specs);

    const [r] = await pool.query(
      `INSERT INTO products (barcode, name, brand, category, unit, price, cost, quantity, min_stock, image_url, sku, specs, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ATIVO')`,
      [
        String(p.barcode).trim(),
        String(p.name).trim(),
        p.brand ?? null,
        p.category ?? null,
        p.unit ?? null,
        toNum(p.price, 0),
        toNum(p.cost, 0),
        toInt(p.quantity, 0),
        toInt(p.min_stock, 0),
        p.image_url ?? null,
        p.sku ?? null,
        JSON.stringify(specsObj),
      ]
    );

    res.json({ id: r.insertId });
  } catch (e) {
    // Ex.: duplicidade de barcode
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.barcode || !String(p.barcode).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: barcode" });
    }
    if (!p.name || !String(p.name).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: name" });
    }

    const specsObj = parseSpecs(p.specs);

    await pool.query(
      `UPDATE products
       SET barcode=?, name=?, brand=?, category=?, unit=?, price=?, cost=?, quantity=?, min_stock=?, image_url=?, sku=?, specs=?
       WHERE id=?`,
      [
        String(p.barcode).trim(),
        String(p.name).trim(),
        p.brand ?? null,
        p.category ?? null,
        p.unit ?? null,
        toNum(p.price, 0),
        toNum(p.cost, 0),
        toInt(p.quantity, 0),
        toInt(p.min_stock, 0),
        p.image_url ?? null,
        p.sku ?? null,
        JSON.stringify(specsObj),
        req.params.id,
      ]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await pool.query("UPDATE products SET status='INATIVO' WHERE id=?", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*********************
 * SUPPLIERS
 *********************/
app.get("/api/suppliers", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM suppliers WHERE status='ATIVO' ORDER BY name"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/suppliers", async (req, res) => {
  try {
    const { name, contact, email, phone, address } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: name" });
    }
    const [r] = await pool.query(
      "INSERT INTO suppliers (name, contact, email, phone, address, status) VALUES (?,?,?,?,?,'ATIVO')",
      [String(name).trim(), contact ?? null, email ?? null, phone ?? null, address ?? null]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  try {
    const { name, contact, email, phone, address } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Campo obrigatório: name" });
    }
    await pool.query(
      "UPDATE suppliers SET name=?, contact=?, email=?, phone=?, address=? WHERE id=?",
      [String(name).trim(), contact ?? null, email ?? null, phone ?? null, address ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    await pool.query("UPDATE suppliers SET status='INATIVO' WHERE id=?", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*********************
 * REPORTS
 *********************/
app.get("/api/reports/low-stock", async (req, res) => {
  const lim = Math.min(Math.max(toInt(req.query.limit, 100), 1), 1000);

  try {
    const [rows] = await pool.query(
      `
      SELECT p.*
      FROM products p
      CROSS JOIN (SELECT COALESCE((SELECT low_stock_alert FROM settings WHERE id=1), 10) AS alert) s
      WHERE p.status='ATIVO'
        AND p.quantity < (CASE WHEN COALESCE(p.min_stock,0) > 0 THEN p.min_stock ELSE s.alert END)
      ORDER BY p.quantity ASC, p.name ASC
      LIMIT ?
      `,
      [lim]
    );

    res.json(rows.map(normalizeRow));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reports/by-category", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COALESCE(category,'Sem categoria') AS category,
        COUNT(*) AS count,
        COALESCE(SUM(quantity),0) AS total_qty,
        COALESCE(SUM(price * quantity),0) AS total_value
      FROM products
      WHERE status='ATIVO'
      GROUP BY COALESCE(category,'Sem categoria')
      ORDER BY total_value DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reports/top-products", async (req, res) => {
  const metric = String(req.query.metric || "value"); // value | quantity
  const lim = Math.min(Math.max(toInt(req.query.limit, 10), 1), 200);
  const category = req.query.category ? String(req.query.category) : null;

  try {
    let sql = `
      SELECT
        id, barcode, name, brand, category, unit, price, cost, quantity, min_stock, image_url, sku,
        (price * quantity) AS total_value
      FROM products
      WHERE status='ATIVO'
    `;
    const params = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (metric === "quantity") {
      sql += ` ORDER BY quantity DESC, name ASC LIMIT ?`;
    } else {
      sql += ` ORDER BY (price * quantity) DESC, name ASC LIMIT ?`;
    }
    params.push(lim);

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(normalizeRow));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*********************
 * START
 *********************/
const PORT = +(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`🔥 API rodando em http://localhost:${PORT}`));