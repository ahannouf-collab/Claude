import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const TABLE = "desh_reactivation";
const KEY = ["account_no"];
const FN = "BOA.DESH.REACTIVATE";

export const m05Router = Router();

m05Router.get("/search", (req, res) => {
  const { cif, account } = req.query as Record<string, string | undefined>;
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
  const rows = db.prepare(`SELECT * FROM ${TABLE} WHERE ${clauses.join(" AND ")} ORDER BY created_ts DESC`).all(...params);
  res.json(rows);
});

m05Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Demande de réactivation introuvable." });
  res.json(row);
});

m05Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Demande introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(TABLE, row.account_no as string));
});

m05Router.get("/:id/versions", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Demande introuvable." });
  res.json(listVersions(TABLE, KEY, [row.account_no]));
});

m05Router.post("/", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { cif, account_no, reactivation_reason, document_ref, expectedVersion } = req.body ?? {};
    if (!cif || !account_no || !reactivation_reason || !document_ref) {
      throw new WorkflowError("Customer/CIF, Account, Reactivation Reason et Document Ref sont obligatoires (RG-08).");
    }
    const account = db.prepare(`SELECT * FROM account WHERE account_no = ? AND cif = ?`).get(account_no, cif) as
      | { status: string }
      | undefined;
    if (!account) throw new WorkflowError("Compte introuvable ou non rattaché au Tiers/CIF.");
    // RG-07 : la réactivation manuelle n'est permise que pour un compte dans un statut réactivable.
    if (account.status !== "DESHERENCE") {
      throw new WorkflowError("La réactivation manuelle n'est permise que pour un compte au statut DESHERENCE (RG-07).");
    }
    const row = saveVersion(
      TABLE,
      KEY,
      [account_no],
      { cif, current_status: account.status, reactivation_reason, document_ref, decision: null, reject_motif: null },
      actor.login,
      expectedVersion
    );
    audit({ actor, action: "Save", functionId: FN, entity: TABLE, entityId: account_no, after: row });
    res.status(201).json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m05Router.delete("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const result = deleteUnauthorized(TABLE, Number(req.params.id), KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: TABLE, entityId: (before as any)?.account_no, before });
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
