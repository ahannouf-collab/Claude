import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";

export const m9Router = Router();

// M9 - Exploitation - MCL Commutation Monitor
m9Router.get("/", (req, res) => {
  const { from_date, mode, mismatch_only, status } = req.query as Record<string, string | undefined>;
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (from_date) {
    clauses.push("date(ts) >= date(?)");
    params.push(from_date);
  }
  if (mode && mode !== "All - RT / Batch") {
    clauses.push("mode = ?");
    params.push(mode);
  }
  if (mismatch_only === "Y") {
    clauses.push("theoretical <> fcubs_value");
  }
  if (status && status !== "All") {
    clauses.push("status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM commutation_history ${where} ORDER BY ts DESC`).all(...params);
  res.json(rows);
});

// Retry: correction idempotente - UPDATE FCUBS seulement si relecture confirme l'écart (RG-M9-05/06)
m9Router.post("/:id/retry", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM commutation_history WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: "Job introuvable." });
  if (row.theoretical === row.fcubs_value) {
    return res.status(400).json({ error: "Aucun écart détecté à la relecture ; correction sans objet (RG-M9-06)." });
  }
  const correlationId = randomUUID();
  db.prepare(
    `UPDATE commutation_history SET fcubs_value = theoretical, status = 'Corrected', retry_count = retry_count + 1, correlation_id = ? WHERE id = ?`
  ).run(correlationId, id);

  const updated = db.prepare(`SELECT * FROM commutation_history WHERE id = ?`).get(id) as Record<string, unknown>;
  db.prepare(
    `INSERT INTO fcubs_account_restriction (account_no, native_restriction, last_commutation_ts)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(account_no) DO UPDATE SET native_restriction = excluded.native_restriction, last_commutation_ts = excluded.last_commutation_ts`
  ).run(updated.account_no, updated.theoretical);

  res.json(updated);
});
