import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";

export const m6Router = Router();

// M6 - Exploitation - Event Interface Rejection Monitor
m6Router.get("/", (req, res) => {
  const { from_date, reject_type, source, status } = req.query as Record<string, string | undefined>;
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (from_date) {
    clauses.push("date(ts) >= date(?)");
    params.push(from_date);
  }
  if (reject_type && reject_type !== "All") {
    clauses.push("reject_type = ?");
    params.push(reject_type);
  }
  if (source && source !== "All Applications") {
    clauses.push("source = ?");
    params.push(source);
  }
  if (status && status !== "All") {
    clauses.push("status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM event_rejection_log ${where} ORDER BY ts DESC`).all(...params);
  res.json(rows);
});

// Retry: action contextuelle via service idempotent et journalisé (RG-M6-05/06)
m6Router.post("/:id/retry", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM event_rejection_log WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: "Rejet introuvable." });
  if (row.status === "Closed") return res.status(400).json({ error: "Un rejet clôturé ne peut être rejoué." });
  const correlationId = randomUUID();
  db.prepare(
    `UPDATE event_rejection_log SET status = 'Investigating', retry_count = retry_count + 1, correlation_id = ? WHERE id = ?`
  ).run(correlationId, id);
  res.json(db.prepare(`SELECT * FROM event_rejection_log WHERE id = ?`).get(id));
});

m6Router.post("/:id/close", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`UPDATE event_rejection_log SET status = 'Closed' WHERE id = ?`).run(id);
  res.json(db.prepare(`SELECT * FROM event_rejection_log WHERE id = ?`).get(id));
});
