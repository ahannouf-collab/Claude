import { db } from "./db.js";

export type RecordStatus = "DRAFT" | "SUBMITTED" | "AUTHORIZED";

export class WorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function whereClause(keyColumns: string[]) {
  return keyColumns.map((c) => `${c} = ?`).join(" AND ");
}

export function nextVersion(table: string, keyColumns: string[], keyValues: unknown[]): number {
  const row = db
    .prepare(`SELECT MAX(version) AS v FROM ${table} WHERE ${whereClause(keyColumns)}`)
    .get(...keyValues) as { v: number | null };
  return (row.v ?? 0) + 1;
}

export function getCurrent(table: string, keyColumns: string[], keyValues: unknown[]) {
  return db
    .prepare(`SELECT * FROM ${table} WHERE is_current = 1 AND ${whereClause(keyColumns)}`)
    .get(...keyValues) as Record<string, unknown> | undefined;
}

export function listVersions(table: string, keyColumns: string[], keyValues: unknown[]) {
  return db
    .prepare(`SELECT * FROM ${table} WHERE ${whereClause(keyColumns)} ORDER BY version DESC`)
    .all(...keyValues) as Record<string, unknown>[];
}

export function getById(table: string, id: number) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
}

export function submit(table: string, id: number, maker: string) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "DRAFT") throw new WorkflowError("Submit exige que le record soit à l'état Draft.");
  db.prepare(
    `UPDATE ${table} SET status = 'SUBMITTED', maker = ?, maker_ts = datetime('now'), last_action = 'Submit' WHERE id = ?`
  ).run(maker, id);
  return getById(table, id);
}

export function authorize(table: string, id: number, checker: string) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "SUBMITTED") throw new WorkflowError("Authorize exige que le record soit à l'état Submitted (RG: Submit avant Authorize).");
  if (row.maker === checker) throw new WorkflowError("Le Checker doit être distinct du Maker (contrôle 4 yeux).", 403);
  db.prepare(
    `UPDATE ${table} SET status = 'AUTHORIZED', checker = ?, checker_ts = datetime('now'), last_action = 'Authorize' WHERE id = ?`
  ).run(checker, id);
  return getById(table, id);
}

/** Unlock an AUTHORIZED current record: create a new draft version copied from it. */
export function unlock(
  table: string,
  id: number,
  keyColumns: string[],
  copyExtra: (row: Record<string, unknown>) => Record<string, unknown>
) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "AUTHORIZED" || row.is_current !== 1) {
    throw new WorkflowError("Unlock exige un record autorisé et courant (profil modificateur).");
  }
  const keyValues = keyColumns.map((c) => row[c]);
  const version = nextVersion(table, keyColumns, keyValues);
  const extra = copyExtra(row);
  const cols = ["version", "is_current", "status", "maker", "maker_ts", "checker", "checker_ts", "last_action", ...Object.keys(extra)];
  const placeholders = cols.map(() => "?").join(", ");
  const values = [version, 1, "DRAFT", null, null, null, null, "Unlock", ...Object.values(extra)];
  db.prepare(`UPDATE ${table} SET is_current = 0 WHERE id = ?`).run(id);
  const info = db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
  return getById(table, info.lastInsertRowid as number);
}

/** Delete a DRAFT record. If it is version 1 (never authorized), hard delete. Otherwise restore previous authorized version as current. */
export function deleteDraft(table: string, id: number, keyColumns: string[]) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "DRAFT") throw new WorkflowError("Delete est réservé aux brouillons non autorisés.");
  const keyValues = keyColumns.map((c) => row[c]);
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if ((row.version as number) > 1) {
    const prev = db
      .prepare(`SELECT id FROM ${table} WHERE ${whereClause(keyColumns)} ORDER BY version DESC LIMIT 1`)
      .get(...keyValues) as { id: number } | undefined;
    if (prev) db.prepare(`UPDATE ${table} SET is_current = 1 WHERE id = ?`).run(prev.id);
  }
  return { deleted: true };
}
