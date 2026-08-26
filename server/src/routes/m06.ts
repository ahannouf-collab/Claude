import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, getById, WorkflowError } from "../workflow.js";

const TABLE = "desh_reactivation";
const FN = "BOA.DESH.REACT.AUTH";

export const m06Router = Router();

m06Router.get("/search", (req, res) => {
  const { cif, account, status } = req.query as Record<string, string | undefined>;
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
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  const rows = db.prepare(`SELECT * FROM ${TABLE} WHERE ${clauses.join(" AND ")} ORDER BY created_ts DESC`).all(...params);
  res.json(rows);
});

m06Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Demande de réactivation introuvable." });
  res.json(row);
});

m06Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Demande introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(TABLE, row.account_no as string));
});

m06Router.post("/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { decision, motif } = req.body ?? {};
    if (decision !== "APPROVE" && decision !== "REJECT") throw new WorkflowError("Decision doit être APPROVE ou REJECT.");
    if (decision === "REJECT" && !motif) throw new WorkflowError("Un motif est obligatoire pour un rejet.");

    const before = getById(TABLE, Number(req.params.id));
    if (!before) throw new WorkflowError("Demande introuvable.", 404);
    // RG-07 : relit le statut courant et refuse toute demande déjà traitée ou devenue incohérente.
    if (before.status !== "U") throw new WorkflowError("Cette demande a déjà été traitée (RG-07).", 409);
    if (before.maker === actor.login) throw new WorkflowError("Le Checker doit être distinct du Maker (contrôle 4 yeux — RG-04).", 403);
    const account = db.prepare(`SELECT status FROM account WHERE account_no = ?`).get(before.account_no) as { status: string } | undefined;
    if (!account || account.status !== "DESHERENCE") {
      throw new WorkflowError("Le compte n'est plus dans un état réactivable (RG-07) — demande incohérente.", 409);
    }

    db.prepare(
      `UPDATE ${TABLE} SET status = 'A', decision = ?, reject_motif = ?, checker = ?, checker_ts = datetime('now'), last_action = 'Authorize', updated_ts = datetime('now') WHERE id = ?`
    ).run(decision, decision === "REJECT" ? motif : null, actor.login, before.id);
    const after = getById(TABLE, before.id as number) as Record<string, unknown>;
    audit({ actor, action: decision === "APPROVE" ? "Reactivate" : "Reject", functionId: FN, entity: TABLE, entityId: before.account_no as string, before, after, motif });

    if (decision === "APPROVE") {
      // RG-08 : après autorisation, le statut du compte est recalculé et la demande est clôturée.
      const accountBefore = db.prepare(`SELECT * FROM account WHERE account_no = ?`).get(before.account_no);
      db.prepare(`UPDATE account SET status = 'ACTIVE', last_movement_date = date('now') WHERE account_no = ?`).run(before.account_no);
      const accountAfter = db.prepare(`SELECT * FROM account WHERE account_no = ?`).get(before.account_no);
      audit({ actor, action: "Reactivate", functionId: FN, entity: "account", entityId: before.account_no as string, before: accountBefore, after: accountAfter });
    }
    res.json(after);
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
