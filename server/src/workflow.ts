import { randomUUID } from "node:crypto";
import { db } from "./db.js";

/** Auth status codes used across the déshérence screens: U = non autorisé, A = autorisé. */
export type AuthStatus = "U" | "A";

export class WorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface Actor {
  login: string;
  role: string;
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

/**
 * Save (New/Save action). If the target key has no current record, inserts version 1 as 'U'.
 * If the current record is already 'U' (still Maker's own draft), updates it in place.
 * If the current record is 'A' (already authorized), RG-07: a new version is created instead
 * of overwriting the authorized data — the previous version stays historized untouched.
 */
export function saveVersion(
  table: string,
  keyColumns: string[],
  keyValues: unknown[],
  fields: Record<string, unknown>,
  maker: string,
  expectedVersion?: number
): Record<string, unknown> {
  const current = getCurrent(table, keyColumns, keyValues);
  if (current && expectedVersion !== undefined && (current.version as number) !== expectedVersion) {
    throw new WorkflowError(
      "Le record a été modifié depuis son chargement (contrôle de version optimiste).",
      409
    );
  }
  if (!current) {
    const cols = [...keyColumns, "version", "is_current", "status", "maker", "maker_ts", "last_action", ...Object.keys(fields)];
    const placeholders = cols.map(() => "?").join(", ");
    const values = [...keyValues, 1, 1, "U", maker, nowTs(), "New", ...Object.values(fields)];
    const info = db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
    return getById(table, info.lastInsertRowid as number)!;
  }
  if (current.status === "U") {
    const setCols = Object.keys(fields);
    const setClause = [...setCols.map((c) => `${c} = ?`), "maker = ?", "maker_ts = ?", "last_action = 'Save'", "updated_ts = datetime('now')"].join(", ");
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...Object.values(fields), maker, nowTs(), current.id);
    return getById(table, current.id as number)!;
  }
  // current.status === 'A' — revise: new version, previous stays historized as-is.
  const version = nextVersion(table, keyColumns, keyValues);
  const cols = [...keyColumns, "version", "is_current", "status", "maker", "maker_ts", "last_action", ...Object.keys(fields)];
  const placeholders = cols.map(() => "?").join(", ");
  const values = [...keyValues, version, 1, "U", maker, nowTs(), "Save", ...Object.values(fields)];
  db.prepare(`UPDATE ${table} SET is_current = 0 WHERE id = ?`).run(current.id);
  const info = db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
  return getById(table, info.lastInsertRowid as number)!;
}

/** Authorize (RG-04: checker must differ from maker; RG-05: rereads status/version freshness beforehand). */
export function authorizeRecord(table: string, id: number, checker: string) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "U") throw new WorkflowError("Authorize exige un enregistrement non autorisé (statut U).");
  if (row.maker === checker) throw new WorkflowError("Le Checker doit être distinct du Maker (contrôle 4 yeux — RG-04).", 403);
  db.prepare(
    `UPDATE ${table} SET status = 'A', checker = ?, checker_ts = ?, last_action = 'Authorize', updated_ts = datetime('now') WHERE id = ?`
  ).run(checker, nowTs(), id);
  return getById(table, id);
}

/** Delete: only unauthorized (U) records are deletable; if a previous authorized version exists, it is restored as current. */
export function deleteUnauthorized(table: string, id: number, keyColumns: string[]) {
  const row = getById(table, id);
  if (!row) throw new WorkflowError("Enregistrement introuvable.", 404);
  if (row.status !== "U") throw new WorkflowError("Delete est réservé aux enregistrements non autorisés (statut U).");
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

function nowTs() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/** Append-only audit trail (RG-06): every sensitive consult/decision/authorize/reject/reactivate/export is logged. */
export function audit(entry: {
  actor: Actor;
  action: string;
  functionId: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  result?: "SUCCESS" | "REFUSED";
  correlationId?: string;
  motif?: string;
}) {
  db.prepare(
    `INSERT INTO audit_log (actor, role, action, function_id, entity, entity_id, before_json, after_json, result, correlation_id, motif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.actor.login,
    entry.actor.role,
    entry.action,
    entry.functionId,
    entry.entity,
    entry.entityId != null ? String(entry.entityId) : null,
    entry.before !== undefined ? JSON.stringify(entry.before) : null,
    entry.after !== undefined ? JSON.stringify(entry.after) : null,
    entry.result ?? "SUCCESS",
    entry.correlationId ?? randomUUID(),
    entry.motif ?? null
  );
}

export function listAudit(entity: string, entityId?: string | number) {
  if (entityId !== undefined) {
    return db
      .prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`)
      .all(entity, String(entityId));
  }
  return db.prepare(`SELECT * FROM audit_log WHERE entity = ? ORDER BY ts DESC LIMIT 200`).all(entity);
}

export function actorFromRequest(req: import("express").Request): Actor {
  const login = (req.body?.actorLogin ?? req.query.actorLogin ?? req.headers["x-actor-login"]) as string | undefined;
  const role = (req.body?.actorRole ?? req.query.actorRole ?? req.headers["x-actor-role"]) as string | undefined;
  if (!login || !role) throw new WorkflowError("Identité utilisateur manquante (login/rôle).", 401);
  return { login, role };
}

export function newCorrelationId() {
  return randomUUID();
}
