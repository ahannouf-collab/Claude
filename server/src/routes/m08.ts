import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, authorizeRecord, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const TABLE = "desh_exception";
const KEY = ["exception_id"];
const FN = "BOA.DESH.RECON.EXC";

export const m08Router = Router();

m08Router.get("/search", (req, res) => {
  const { status, cif, account } = req.query as Record<string, string | undefined>;
  const clauses: string[] = ["is_current = 1"];
  const params: unknown[] = [];
  if (status) {
    clauses.push("cycle_status = ?");
    params.push(status);
  }
  if (cif) {
    clauses.push("cif LIKE ?");
    params.push(`%${cif}%`);
  }
  if (account) {
    clauses.push("account_no LIKE ?");
    params.push(`%${account}%`);
  }
  const rows = db.prepare(`SELECT * FROM ${TABLE} WHERE ${clauses.join(" AND ")} ORDER BY created_ts DESC`).all(...params);
  res.json(rows);
});

m08Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Exception introuvable." });
  res.json(row);
});

m08Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Exception introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(TABLE, row.exception_id as string));
});

m08Router.get("/:id/versions", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Exception introuvable." });
  res.json(listVersions(TABLE, KEY, [row.exception_id]));
});

m08Router.post("/", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { exception_id, cif, account_no, exception_type, owner } = req.body ?? {};
    if (!exception_id || !cif || !account_no || !exception_type || !owner) {
      throw new WorkflowError("Exception ID, Customer/CIF, Account, Exception Type et Owner sont obligatoires.");
    }
    const row = saveVersion(
      TABLE,
      KEY,
      [exception_id],
      { cif, account_no, exception_type, owner, cycle_status: "OPEN", comment: null, corrective_action: null, resolved_ts: null },
      actor.login
    );
    audit({ actor, action: "Create", functionId: FN, entity: TABLE, entityId: exception_id, after: row });
    res.status(201).json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m08Router.put("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Exception introuvable.", 404);
    if (before.status !== "U") throw new WorkflowError("L'investigation ne peut être mise à jour que sur une exception non résolue/autorisée.");
    const { comment, corrective_action, owner, expectedVersion } = req.body ?? {};
    const row = saveVersion(
      TABLE,
      KEY,
      [before.exception_id],
      {
        owner: owner ?? before.owner,
        comment: comment ?? before.comment,
        corrective_action: corrective_action ?? before.corrective_action,
        cycle_status: "IN_PROGRESS",
      },
      actor.login,
      expectedVersion
    );
    audit({ actor, action: "Save", functionId: FN, entity: TABLE, entityId: before.exception_id as string, before, after: row });
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m08Router.post("/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Exception introuvable.", 404);
    // RG-08 : la résolution exige un commentaire, une action corrective et un horodatage.
    if (!before.comment || !before.corrective_action) {
      throw new WorkflowError("Un commentaire et une action corrective sont obligatoires avant résolution (RG-08).");
    }
    db.prepare(`UPDATE ${TABLE} SET cycle_status = 'RESOLVED', resolved_ts = datetime('now') WHERE id = ?`).run(before.id);
    const row = authorizeRecord(TABLE, Number(req.params.id), actor.login);
    audit({ actor, action: "Authorize", functionId: FN, entity: TABLE, entityId: before.exception_id as string, before, after: row });
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m08Router.delete("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const result = deleteUnauthorized(TABLE, Number(req.params.id), KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: TABLE, entityId: (before as any)?.exception_id, before });
    res.json(result);
  } catch (e) {
    handleError(e, res, req);
  }
});

function handleError(e: unknown, res: import("express").Response, req?: import("express").Request) {
  if (e instanceof WorkflowError) {
    if (req) {
      try {
        const actor = actorFromRequest(req);
        audit({ actor, action: "Refuse", functionId: FN, entity: TABLE, entityId: req.params.id, result: "REFUSED", motif: e.message });
      } catch {
        /* identity missing */
      }
    }
    return res.status(e.status).json({ error: e.message });
  }
  console.error(e);
  res.status(500).json({ error: "Erreur interne." });
}
