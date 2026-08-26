import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, authorizeRecord, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const TABLE = "desh_decision_n1";
const KEY = ["dossier_id"];
const FN = "BOA.DESH.N1.WORKLIST";
const VALID_DECISIONS = ["PENDING", "APPROVE", "REJECT", "HOLD"];

export const m03Router = Router();

m03Router.get("/search", (req, res) => {
  const { cif, account, decision } = req.query as Record<string, string | undefined>;
  const clauses: string[] = ["is_current = 1"];
  const params: unknown[] = [];
  if (cif) {
    clauses.push("cif LIKE ?");
    params.push(`%${cif}%`);
  }
  if (account) {
    clauses.push("account_no LIKE ?");
    params.push(`%${account}%`);
  }
  if (decision) {
    clauses.push("decision = ?");
    params.push(decision);
  }
  const rows = db.prepare(`SELECT * FROM ${TABLE} WHERE ${clauses.join(" AND ")} ORDER BY inactive_days DESC`).all(...params);
  res.json(rows);
});

m03Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N1 introuvable." });
  res.json(row);
});

m03Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N1 introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(TABLE, String(row.dossier_id)));
});

m03Router.get("/:id/versions", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N1 introuvable." });
  res.json(listVersions(TABLE, KEY, [row.dossier_id]));
});

m03Router.put("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Décision N1 introuvable.", 404);
    const { decision, motif, expectedVersion } = req.body ?? {};
    if (!VALID_DECISIONS.includes(decision)) throw new WorkflowError("Decision invalide.");
    if ((decision === "REJECT" || decision === "HOLD") && !motif) {
      throw new WorkflowError("Un motif est obligatoire pour un rejet ou une mise en attente (RG-08).");
    }
    // RG-05 : relit le solde et le statut avant persistance d'une décision sensible.
    const account = db.prepare(`SELECT book_balance, status FROM account WHERE account_no = ?`).get(before.account_no) as
      | { book_balance: number; status: string }
      | undefined;
    if (!account) throw new WorkflowError("Compte introuvable — décision impossible.");
    const row = saveVersion(
      TABLE,
      KEY,
      [before.dossier_id],
      { decision, motif: motif ?? null, book_balance: account.book_balance },
      actor.login,
      expectedVersion
    );
    audit({ actor, action: "Save", functionId: FN, entity: TABLE, entityId: before.dossier_id as number, before, after: row, motif });
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m03Router.post("/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Décision N1 introuvable.", 404);
    const row = authorizeRecord(TABLE, Number(req.params.id), actor.login) as Record<string, unknown>;
    audit({ actor, action: "Authorize", functionId: FN, entity: TABLE, entityId: row.dossier_id as number, before, after: row });

    if (row.decision === "APPROVE") {
      const existingN2 = db.prepare(`SELECT id FROM desh_decision_n2 WHERE decision_n1_id = ?`).get(row.id);
      if (!existingN2) {
        db.prepare(
          `INSERT INTO desh_decision_n2 (decision_n1_id, cif, account_no, book_balance, inactive_days, proposal, decision, version, is_current, status, last_action)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 1, 1, 'U', 'New')`
        ).run(row.id, row.cif, row.account_no, row.book_balance, row.inactive_days, row.proposal);
        audit({ actor, action: "Create", functionId: "BOA.DESH.N2.WORKLIST", entity: "desh_decision_n2", entityId: row.id as number, after: { decision_n1_id: row.id } });
      }
    }
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m03Router.delete("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const result = deleteUnauthorized(TABLE, Number(req.params.id), KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: TABLE, entityId: (before as any)?.dossier_id, before });
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
