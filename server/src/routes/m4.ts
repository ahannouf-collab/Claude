import { Router } from "express";
import { db } from "../db.js";
import { authorize, deleteDraft, getById, getCurrent, listVersions, nextVersion, submit, unlock, WorkflowError } from "../workflow.js";

const TABLE = "ref_event_reason";
const KEY = ["event_code", "reason_code"];

export const m4Router = Router();

function withTranslations(row: Record<string, unknown> | undefined) {
  if (!row) return row;
  const translations = db
    .prepare(`SELECT language, description, active FROM ref_event_reason_translation WHERE reason_id = ? ORDER BY language`)
    .all(row.id as number);
  return { ...row, translations };
}

function saveTranslations(reasonId: number, translations: { language: string; description: string; active?: string }[]) {
  db.prepare(`DELETE FROM ref_event_reason_translation WHERE reason_id = ?`).run(reasonId);
  const insert = db.prepare(
    `INSERT INTO ref_event_reason_translation (reason_id, language, description, active) VALUES (?, ?, ?, ?)`
  );
  for (const t of translations) {
    if (!t.language || !t.description) continue;
    insert.run(reasonId, t.language, t.description, t.active ?? "Y");
  }
}

m4Router.get("/search", (req, res) => {
  const eventCode = String(req.query.event_code ?? "").trim();
  const rows = eventCode
    ? db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 AND event_code = ? ORDER BY reason_code`).all(eventCode)
    : db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 ORDER BY event_code, reason_code`).all();
  res.json(rows.map((r) => withTranslations(r as Record<string, unknown>)));
});

m4Router.get("/:eventCode/:reasonCode", (req, res) => {
  const row = getCurrent(TABLE, KEY, [req.params.eventCode, req.params.reasonCode]);
  if (!row) return res.status(404).json({ error: "Motif introuvable." });
  res.json(withTranslations(row));
});

m4Router.get("/:eventCode/:reasonCode/audit", (req, res) => {
  res.json(listVersions(TABLE, KEY, [req.params.eventCode, req.params.reasonCode]));
});

m4Router.post("/", (req, res) => {
  const { event_code, reason_code, description, translations } = req.body ?? {};
  if (!event_code || !reason_code || !description) {
    return res.status(400).json({ error: "Event Code, Reason Code et Description sont obligatoires (RG-M4-01/03)." });
  }
  const eventRow = db.prepare(`SELECT 1 FROM ref_event_code WHERE event_code = ? AND is_current = 1 AND status = 'AUTHORIZED'`).get(event_code);
  if (!eventRow) return res.status(400).json({ error: "Event Code doit exister et être autorisé (RG-M4-02)." });
  if (getCurrent(TABLE, KEY, [event_code, reason_code])) {
    return res.status(409).json({ error: "Le couple Event Code + Reason Code existe déjà (RG-M4-01)." });
  }
  const version = nextVersion(TABLE, KEY, [event_code, reason_code]);
  const info = db
    .prepare(
      `INSERT INTO ${TABLE} (event_code, reason_code, version, is_current, status, description, last_action)
       VALUES (?, ?, ?, 1, 'DRAFT', ?, 'New')`
    )
    .run(event_code, reason_code, version, description);
  const id = info.lastInsertRowid as number;
  saveTranslations(id, translations ?? []);
  res.status(201).json(withTranslations(getById(TABLE, id)));
});

m4Router.put("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Enregistrement introuvable." });
  if (row.status !== "DRAFT") return res.status(400).json({ error: "Save exige un brouillon non autorisé." });
  const { description, translations } = req.body ?? {};
  db.prepare(`UPDATE ${TABLE} SET description = ?, last_action = 'Save' WHERE id = ?`).run(description ?? row.description, row.id);
  if (translations) saveTranslations(row.id as number, translations);
  res.json(withTranslations(getById(TABLE, row.id as number)));
});

m4Router.post("/:id/submit", (req, res) => {
  try {
    res.json(submit(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG01"));
  } catch (e) {
    handleError(e, res);
  }
});

m4Router.post("/:id/authorize", (req, res) => {
  try {
    res.json(authorize(TABLE, Number(req.params.id), req.body?.user ?? "TPOSIG02"));
  } catch (e) {
    handleError(e, res);
  }
});

m4Router.post("/:id/unlock", (req, res) => {
  try {
    const row = getById(TABLE, Number(req.params.id));
    const unlocked = unlock(TABLE, Number(req.params.id), KEY, (r) => ({
      event_code: r.event_code,
      reason_code: r.reason_code,
      description: r.description,
    }));
    if (row) {
      const translations = db
        .prepare(`SELECT language, description, active FROM ref_event_reason_translation WHERE reason_id = ?`)
        .all(row.id as number) as { language: string; description: string; active: string }[];
      saveTranslations((unlocked as Record<string, unknown>).id as number, translations);
    }
    res.json(withTranslations(unlocked as Record<string, unknown>));
  } catch (e) {
    handleError(e, res);
  }
});

m4Router.delete("/:id", (req, res) => {
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
