import { Router } from "express";
import { db } from "../db.js";
import { authorize, deleteDraft, getById, getCurrent, listVersions, nextVersion, submit, unlock, WorkflowError } from "../workflow.js";

const TABLE = "ref_sop_event_matrix";
const KEY = ["sop", "effective_from"];

export const m5Router = Router();

type MatrixRow = { event: string; impact: string; severity: number; message: string; override?: string; active?: string };

function withRows(row: Record<string, unknown> | undefined) {
  if (!row) return row;
  const rows = db
    .prepare(`SELECT event, impact, severity, message, override, active FROM sop_matrix_row WHERE matrix_id = ? ORDER BY event`)
    .all(row.id as number);
  return { ...row, rows };
}

function saveRows(matrixId: number, rows: MatrixRow[]) {
  db.prepare(`DELETE FROM sop_matrix_row WHERE matrix_id = ?`).run(matrixId);
  const insert = db.prepare(
    `INSERT INTO sop_matrix_row (matrix_id, event, impact, severity, message, override, active) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const allowedImpacts = new Set(["BLOCK_ALL", "BLOCK_DEBIT", "ALERT", "ALLOW"]);
  for (const r of rows) {
    if (!r.event || !allowedImpacts.has(r.impact)) continue;
    insert.run(matrixId, r.event, r.impact, r.severity ?? 0, r.message ?? "", r.override ?? "N", r.active ?? "Y");
  }
}

m5Router.get("/search", (req, res) => {
  const sop = String(req.query.sop ?? "").trim();
  const rows = sop
    ? db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 AND sop LIKE ? ORDER BY effective_from DESC`).all(`%${sop}%`)
    : db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 ORDER BY effective_from DESC`).all();
  res.json(rows.map((r) => withRows(r as Record<string, unknown>)));
});

m5Router.get("/:sop/:effectiveFrom", (req, res) => {
  const row = getCurrent(TABLE, KEY, [decodeURIComponent(req.params.sop), req.params.effectiveFrom]);
  if (!row) return res.status(404).json({ error: "Matrice introuvable." });
  res.json(withRows(row));
});

m5Router.get("/:sop/:effectiveFrom/audit", (req, res) => {
  res.json(listVersions(TABLE, KEY, [decodeURIComponent(req.params.sop), req.params.effectiveFrom]));
});

m5Router.post("/", (req, res) => {
  const { sop, effective_from, rows } = req.body ?? {};
  if (!sop || !effective_from) return res.status(400).json({ error: "SOP et Effective From sont obligatoires (RG-M5-01)." });
  if (getCurrent(TABLE, KEY, [sop, effective_from])) {
    return res.status(409).json({ error: "Une version autorisée existe déjà pour ce SOP à cette date (RG-M5-02)." });
  }
  const version = nextVersion(TABLE, KEY, [sop, effective_from]);
  const info = db
    .prepare(
      `INSERT INTO ${TABLE} (sop, effective_from, version, is_current, status, matrix_status, last_action)
       VALUES (?, ?, ?, 1, 'DRAFT', 'Draft', 'New')`
    )
    .run(sop, effective_from, version);
  const id = info.lastInsertRowid as number;
  saveRows(id, rows ?? []);
  res.status(201).json(withRows(getById(TABLE, id)));
});

m5Router.put("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Enregistrement introuvable." });
  if (row.status !== "DRAFT") return res.status(400).json({ error: "Save exige un brouillon non autorisé." });
  const { rows } = req.body ?? {};
  db.prepare(`UPDATE ${TABLE} SET last_action = 'Save' WHERE id = ?`).run(row.id);
  if (rows) saveRows(row.id as number, rows);
  res.json(withRows(getById(TABLE, row.id as number)));
});

m5Router.post("/:id/submit", (req, res) => {
  try {
    const updated = submit(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG01");
    res.json(updated);
  } catch (e) {
    handleError(e, res);
  }
});

m5Router.post("/:id/authorize", (req, res) => {
  try {
    const updated = authorize(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG02") as Record<string, unknown>;
    db.prepare(`UPDATE ${TABLE} SET matrix_status = 'Published' WHERE id = ?`).run(updated.id);
    res.json(getById(TABLE, updated.id as number));
  } catch (e) {
    handleError(e, res);
  }
});

m5Router.post("/:id/unlock", (req, res) => {
  try {
    const row = getById(TABLE, Number(req.params.id));
    const unlocked = unlock(TABLE, Number(req.params.id), KEY, (r) => ({
      sop: r.sop,
      effective_from: r.effective_from,
      matrix_status: "Draft",
    })) as Record<string, unknown>;
    if (row) {
      const rows = db
        .prepare(`SELECT event, impact, severity, message, override, active FROM sop_matrix_row WHERE matrix_id = ?`)
        .all(row.id as number) as MatrixRow[];
      saveRows(unlocked.id as number, rows);
    }
    res.json(withRows(getById(TABLE, unlocked.id as number)));
  } catch (e) {
    handleError(e, res);
  }
});

m5Router.delete("/:id", (req, res) => {
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
