import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, authorizeRecord, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const TABLE = "desh_decision_n2";
const KEY = ["decision_n1_id"];
const FN = "BOA.DESH.N2.WORKLIST";
const VALID_DECISIONS = ["PENDING", "APPROVE", "REJECT", "HOLD"];

export const m04Router = Router();

m04Router.get("/search", (req, res) => {
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

m04Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N2 introuvable." });
  const n1 = getById("desh_decision_n1", row.decision_n1_id as number);
  res.json({ ...row, n1History: n1 });
});

m04Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N2 introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(TABLE, String(row.decision_n1_id)));
});

m04Router.get("/:id/versions", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Décision N2 introuvable." });
  res.json(listVersions(TABLE, KEY, [row.decision_n1_id]));
});

m04Router.put("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Décision N2 introuvable.", 404);
    const { decision, motif, expectedVersion } = req.body ?? {};
    if (!VALID_DECISIONS.includes(decision)) throw new WorkflowError("Decision invalide.");
    if ((decision === "REJECT" || decision === "HOLD") && !motif) {
      throw new WorkflowError("Un motif est obligatoire pour un rejet ou une mise en attente.");
    }
    const account = db.prepare(`SELECT book_balance, status FROM account WHERE account_no = ?`).get(before.account_no) as
      | { book_balance: number; status: string }
      | undefined;
    if (!account) throw new WorkflowError("Compte introuvable — décision impossible.");
    const row = saveVersion(
      TABLE,
      KEY,
      [before.decision_n1_id],
      { decision, motif: motif ?? null, book_balance: account.book_balance },
      actor.login,
      expectedVersion
    );
    audit({ actor, action: "Save", functionId: FN, entity: TABLE, entityId: before.decision_n1_id as number, before, after: row, motif });
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m04Router.post("/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Décision N2 introuvable.", 404);
    const row = authorizeRecord(TABLE, Number(req.params.id), actor.login) as Record<string, unknown>;
    audit({ actor, action: "Authorize", functionId: FN, entity: TABLE, entityId: row.decision_n1_id as number, before, after: row });

    if (row.decision === "APPROVE") {
      // RG-08 : la validation finale déclenche le traitement cible — bascule du compte en déshérence.
      const accountBefore = db.prepare(`SELECT * FROM account WHERE account_no = ?`).get(row.account_no);
      db.prepare(`UPDATE account SET status = 'DESHERENCE' WHERE account_no = ?`).run(row.account_no);
      const accountAfter = db.prepare(`SELECT * FROM account WHERE account_no = ?`).get(row.account_no);
      audit({
        actor,
        action: "Transfer",
        functionId: FN,
        entity: "account",
        entityId: row.account_no as string,
        before: accountBefore,
        after: accountAfter,
        motif: "Traitement cible workflow déshérence déclenché par la validation N2.",
      });
    }
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m04Router.delete("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const result = deleteUnauthorized(TABLE, Number(req.params.id), KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: TABLE, entityId: (before as any)?.decision_n1_id, before });
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
