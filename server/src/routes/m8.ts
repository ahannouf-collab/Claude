import { Router } from "express";
import { db } from "../db.js";
import { authorize, deleteDraft, getById, getCurrent, listVersions, nextVersion, submit, unlock, WorkflowError } from "../workflow.js";

const TABLE = "mcl_restriction_contrib";
const KEY = ["event_code", "effective_from"];
const CONTRIBUTIONS = new Set(["NO_DEBIT_NO_CREDIT", "NO_DEBIT", "NO_CREDIT", "NONE"]);

export const m8Router = Router();

m8Router.get("/search", (req, res) => {
  const eventCode = String(req.query.event_code ?? "").trim();
  const rows = eventCode
    ? db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 AND event_code = ? ORDER BY effective_from DESC`).all(eventCode)
    : db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 ORDER BY event_code, effective_from DESC`).all();
  res.json(rows);
});

m8Router.get("/:eventCode/:effectiveFrom", (req, res) => {
  const row = getCurrent(TABLE, KEY, [req.params.eventCode, req.params.effectiveFrom]);
  if (!row) return res.status(404).json({ error: "Contribution introuvable." });
  res.json(row);
});

m8Router.get("/:eventCode/:effectiveFrom/audit", (req, res) => {
  res.json(listVersions(TABLE, KEY, [req.params.eventCode, req.params.effectiveFrom]));
});

m8Router.post("/", (req, res) => {
  const { event_code, effective_from, contribution, event_active_status } = req.body ?? {};
  if (!event_code || !effective_from || !contribution) {
    return res.status(400).json({ error: "Event Code, Effective From et Contribution sont obligatoires (RG-M8-01/02)." });
  }
  if (!CONTRIBUTIONS.has(contribution)) return res.status(400).json({ error: "Contribution invalide (RG-M8-02)." });
  const eventRow = db.prepare(`SELECT 1 FROM ref_event_code WHERE event_code = ? AND is_current = 1 AND status = 'AUTHORIZED'`).get(event_code);
  if (!eventRow) return res.status(400).json({ error: "Event Code doit exister et être autorisé (RG-M8-01)." });
  if (getCurrent(TABLE, KEY, [event_code, effective_from])) {
    return res.status(409).json({ error: "Une version existe déjà pour ce couple Event Code + Effective From (RG-M8-03)." });
  }
  const version = nextVersion(TABLE, KEY, [event_code, effective_from]);
  const info = db
    .prepare(
      `INSERT INTO ${TABLE} (event_code, effective_from, version, is_current, status, contribution, event_active_status, last_action)
       VALUES (?, ?, ?, 1, 'DRAFT', ?, ?, 'New')`
    )
    .run(event_code, effective_from, version, contribution, event_active_status ?? "Active");
  res.status(201).json(getById(TABLE, info.lastInsertRowid as number));
});

m8Router.put("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Enregistrement introuvable." });
  if (row.status !== "DRAFT") return res.status(400).json({ error: "Save exige un brouillon non autorisé." });
  const { contribution, event_active_status } = req.body ?? {};
  if (contribution && !CONTRIBUTIONS.has(contribution)) return res.status(400).json({ error: "Contribution invalide." });
  db.prepare(`UPDATE ${TABLE} SET contribution = ?, event_active_status = ?, last_action = 'Save' WHERE id = ?`).run(
    contribution ?? row.contribution,
    event_active_status ?? row.event_active_status,
    row.id
  );
  res.json(getById(TABLE, row.id as number));
});

m8Router.post("/:id/submit", (req, res) => {
  try {
    res.json(submit(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG01"));
  } catch (e) {
    handleError(e, res);
  }
});

m8Router.post("/:id/authorize", (req, res) => {
  try {
    res.json(authorize(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG02"));
  } catch (e) {
    handleError(e, res);
  }
});

m8Router.post("/:id/unlock", (req, res) => {
  try {
    res.json(
      unlock(TABLE, Number(req.params.id), KEY, (row) => ({
        event_code: row.event_code,
        effective_from: row.effective_from,
        contribution: row.contribution,
        event_active_status: row.event_active_status,
      }))
    );
  } catch (e) {
    handleError(e, res);
  }
});

m8Router.delete("/:id", (req, res) => {
  try {
    res.json(deleteDraft(TABLE, Number(req.params.id), KEY));
  } catch (e) {
    handleError(e, res);
  }
});

function handleError(e: unknown, res: import("express").Response) {
  if (e instanceof WorkflowError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: "Erreur interne." });
}
