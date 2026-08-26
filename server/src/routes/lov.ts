import { Router } from "express";
import { db } from "../db.js";

export const lovRouter = Router();

lovRouter.get("/customers", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db.prepare(`SELECT * FROM customer WHERE cif LIKE ? OR full_name LIKE ? ORDER BY cif`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT * FROM customer ORDER BY cif`).all();
  res.json(rows);
});

lovRouter.get("/accounts", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const cif = String(req.query.cif ?? "").trim();
  let rows;
  if (cif) {
    rows = db.prepare(`SELECT * FROM account WHERE cif = ? ORDER BY account_no`).all(cif);
  } else if (q) {
    rows = db
      .prepare(`SELECT * FROM account WHERE account_no LIKE ? OR cif LIKE ? ORDER BY account_no`)
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`SELECT * FROM account ORDER BY account_no`).all();
  }
  res.json(rows);
});

lovRouter.get("/business-date", (_req, res) => {
  const row = db.prepare(`SELECT value FROM system_setting WHERE key = 'business_date'`).get() as
    | { value: string }
    | undefined;
  res.json({ businessDate: row?.value ?? new Date().toISOString().slice(0, 10) });
});

lovRouter.put("/business-date", (req, res) => {
  const { businessDate } = req.body ?? {};
  if (!businessDate) return res.status(400).json({ error: "Date métier requise." });
  db.prepare(`INSERT INTO system_setting (key, value) VALUES ('business_date', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    businessDate
  );
  res.json({ businessDate });
});
