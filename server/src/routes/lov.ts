import { Router } from "express";
import { db } from "../db.js";

export const lovRouter = Router();

lovRouter.get("/accounts", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db.prepare(`SELECT * FROM customer_account WHERE account_no LIKE ? OR customer_name LIKE ? ORDER BY account_no`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT * FROM customer_account ORDER BY account_no`).all();
  res.json(rows);
});

lovRouter.get("/event-codes", (req, res) => {
  const rows = db
    .prepare(`SELECT event_code, description, domain, event_status FROM ref_event_code WHERE is_current = 1 AND status = 'AUTHORIZED' ORDER BY event_code`)
    .all();
  res.json(rows);
});
