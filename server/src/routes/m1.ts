import { Router } from "express";
import { db } from "../db.js";
import { authorize, deleteDraft, getById, getCurrent, listVersions, nextVersion, submit, unlock, WorkflowError } from "../workflow.js";

const TABLE = "ref_event_code";
const KEY = ["event_code"];

export const m1Router = Router();

function withReasons(row: Record<string, unknown> | undefined) {
  if (!row) return row;
  const reasons = db
    .prepare(
      `SELECT reason_code, description, 'Y' AS active, date(created_ts) AS effective_from FROM ref_event_reason
       WHERE event_code = ? AND is_current = 1 AND status = 'AUTHORIZED' ORDER BY reason_code`
    )
    .all(row.event_code as string);
  return { ...row, reasons };
}

m1Router.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db
        .prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 AND event_code LIKE ? ORDER BY event_code`)
        .all(`%${q}%`)
    : db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 ORDER BY event_code`).all();
  res.json(rows);
});

m1Router.get("/:eventCode", (req, res) => {
  const row = getCurrent(TABLE, KEY, [req.params.eventCode]);
  if (!row) return res.status(404).json({ error: "Event Code introuvable." });
  res.json(withReasons(row));
});

m1Router.get("/:eventCode/audit", (req, res) => {
  res.json(listVersions(TABLE, KEY, [req.params.eventCode]));
});

m1Router.post("/", (req, res) => {
  const { event_code, description, domain, event_status } = req.body ?? {};
  if (!event_code || !description || !domain) {
    return res.status(400).json({ error: "Event Code, Description et Domain sont obligatoires (RG-M1-01/02/04)." });
  }
  const existing = getCurrent(TABLE, KEY, [event_code]);
  if (existing) return res.status(409).json({ error: "Event Code déjà existant (RG-M1-01 : unicité)." });
  const version = nextVersion(TABLE, KEY, [event_code]);
  const info = db
    .prepare(
      `INSERT INTO ${TABLE} (event_code, version, is_current, status, description, domain, event_status, last_action)
       VALUES (?, ?, 1, 'DRAFT', ?, ?, ?, 'New')`
    )
    .run(event_code, version, description, domain, event_status ?? "Active");
  res.status(201).json(getById(TABLE, info.lastInsertRowid as number));
});

m1Router.put("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Enregistrement introuvable." });
  if (row.status !== "DRAFT") return res.status(400).json({ error: "Save exige un brouillon non autorisé." });
  const { description, domain, event_status } = req.body ?? {};
  db.prepare(`UPDATE ${TABLE} SET description = ?, domain = ?, event_status = ?, last_action = 'Save' WHERE id = ?`).run(
    description ?? row.description,
    domain ?? row.domain,
    event_status ?? row.event_status,
    row.id
  );
  res.json(getById(TABLE, Number(req.params.id)));
});

m1Router.post("/:id/submit", (req, res) => {
  try {
    res.json(submit(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG01"));
  } catch (e) {
    handleError(e, res);
  }
});

m1Router.post("/:id/authorize", (req, res) => {
  try {
    res.json(authorize(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG02"));
  } catch (e) {
    handleError(e, res);
  }
});

m1Router.post("/:id/unlock", (req, res) => {
  try {
    res.json(
      unlock(TABLE, Number(req.params.id), KEY, (row) => ({
        event_code: row.event_code,
        description: row.description,
        domain: row.domain,
        event_status: row.event_status,
      }))
    );
  } catch (e) {
    handleError(e, res);
  }
});

m1Router.delete("/:id", (req, res) => {
  try {
    res.json(deleteDraft(TABLE, Number(req.params.id), KEY));
  } catch (e) {
    handleError(e, res);
  }
});

m1Router.post("/:id/copy", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Enregistrement introuvable." });
  const { event_code } = req.body ?? {};
  if (!event_code) return res.status(400).json({ error: "Nouveau Event Code requis pour Copy." });
  if (getCurrent(TABLE, KEY, [event_code])) return res.status(409).json({ error: "Event Code déjà existant." });
  const info = db
    .prepare(
      `INSERT INTO ${TABLE} (event_code, version, is_current, status, description, domain, event_status, last_action)
       VALUES (?, 1, 1, 'DRAFT', ?, ?, ?, 'Copy')`
    )
    .run(event_code, row.description, row.domain, row.event_status);
  res.status(201).json(getById(TABLE, info.lastInsertRowid as number));
});

function handleError(e: unknown, res: import("express").Response) {
  if (e instanceof WorkflowError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: "Erreur interne." });
}
