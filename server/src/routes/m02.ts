import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, authorizeRecord, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const FN = "BOA.DESH.ELIG";
const RULE_TABLE = "desh_eligibility_rule";
const RULE_KEY = ["category_code", "bank_transaction"];
const UNAVAIL_TABLE = "desh_unavailable_account";
const UNAVAIL_KEY = ["account_no"];

export const m02Router = Router();

// ----- Catégories / transactions BANK -----
m02Router.get("/rules", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db.prepare(`SELECT * FROM ${RULE_TABLE} WHERE is_current = 1 AND category_code LIKE ? ORDER BY category_code`).all(`%${q}%`)
    : db.prepare(`SELECT * FROM ${RULE_TABLE} WHERE is_current = 1 ORDER BY category_code`).all();
  res.json(rows);
});

m02Router.get("/rules/:id", (req, res) => {
  const row = getById(RULE_TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Règle introuvable." });
  res.json(row);
});

m02Router.get("/rules/:id/versions", (req, res) => {
  const row = getById(RULE_TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Règle introuvable." });
  res.json(listVersions(RULE_TABLE, RULE_KEY, [row.category_code, row.bank_transaction]));
});

m02Router.get("/rules/:id/audit", (req, res) => {
  const row = getById(RULE_TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Règle introuvable." });
  res.json(
    db
      .prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`)
      .all(RULE_TABLE, `${row.category_code}/${row.bank_transaction}`)
  );
});

m02Router.post("/rules", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { category_code, bank_transaction, currency, threshold, expectedVersion } = req.body ?? {};
    if (!category_code || !bank_transaction || threshold === undefined) {
      throw new WorkflowError("Product/Category, BANK Transaction et Threshold sont obligatoires.");
    }
    if (Number(threshold) < 0) throw new WorkflowError("Threshold doit être positif.");
    const key = [category_code, bank_transaction];
    const row = saveVersion(RULE_TABLE, RULE_KEY, key, { currency: currency ?? "MAD", threshold: Number(threshold) }, actor.login, expectedVersion);
    audit({ actor, action: "Save", functionId: FN, entity: RULE_TABLE, entityId: `${category_code}/${bank_transaction}`, after: row });
    res.status(201).json(row);
  } catch (e) {
    handleError(e, res, req, RULE_TABLE);
  }
});

m02Router.post("/rules/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(RULE_TABLE, Number(req.params.id));
    const row = authorizeRecord(RULE_TABLE, Number(req.params.id), actor.login);
    audit({ actor, action: "Authorize", functionId: FN, entity: RULE_TABLE, entityId: `${(row as any)?.category_code}/${(row as any)?.bank_transaction}`, before, after: row });
    res.json(row);
  } catch (e) {
    handleError(e, res, req, RULE_TABLE);
  }
});

m02Router.delete("/rules/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(RULE_TABLE, Number(req.params.id));
    const result = deleteUnauthorized(RULE_TABLE, Number(req.params.id), RULE_KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: RULE_TABLE, entityId: `${(before as any)?.category_code}/${(before as any)?.bank_transaction}`, before });
    res.json(result);
  } catch (e) {
    handleError(e, res, req, RULE_TABLE);
  }
});

// ----- Comptes indisponibles -----
m02Router.get("/unavailable", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db.prepare(`SELECT * FROM ${UNAVAIL_TABLE} WHERE is_current = 1 AND account_no LIKE ? ORDER BY account_no`).all(`%${q}%`)
    : db.prepare(`SELECT * FROM ${UNAVAIL_TABLE} WHERE is_current = 1 ORDER BY account_no`).all();
  res.json(rows);
});

m02Router.get("/unavailable/:id/audit", (req, res) => {
  const row = getById(UNAVAIL_TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Compte indisponible introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY ts DESC`).all(UNAVAIL_TABLE, row.account_no as string));
});

m02Router.post("/unavailable", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { account_no, reason, expectedVersion } = req.body ?? {};
    if (!account_no || !reason) throw new WorkflowError("Account et Reason sont obligatoires (justification requise — RG-08).");
    const account = db.prepare(`SELECT account_no FROM account WHERE account_no = ?`).get(account_no);
    if (!account) throw new WorkflowError("Compte introuvable au référentiel.");
    const row = saveVersion(UNAVAIL_TABLE, UNAVAIL_KEY, [account_no], { reason }, actor.login, expectedVersion);
    audit({ actor, action: "Save", functionId: FN, entity: UNAVAIL_TABLE, entityId: account_no, after: row });
    res.status(201).json(row);
  } catch (e) {
    handleError(e, res, req, UNAVAIL_TABLE);
  }
});

m02Router.post("/unavailable/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(UNAVAIL_TABLE, Number(req.params.id));
    const row = authorizeRecord(UNAVAIL_TABLE, Number(req.params.id), actor.login);
    audit({ actor, action: "Authorize", functionId: FN, entity: UNAVAIL_TABLE, entityId: (row as any)?.account_no, before, after: row });
    res.json(row);
  } catch (e) {
    handleError(e, res, req, UNAVAIL_TABLE);
  }
});

m02Router.delete("/unavailable/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(UNAVAIL_TABLE, Number(req.params.id));
    const result = deleteUnauthorized(UNAVAIL_TABLE, Number(req.params.id), UNAVAIL_KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: UNAVAIL_TABLE, entityId: (before as any)?.account_no, before });
    res.json(result);
  } catch (e) {
    handleError(e, res, req, UNAVAIL_TABLE);
  }
});

function handleError(e: unknown, res: import("express").Response, req?: import("express").Request, entity?: string) {
  if (e instanceof WorkflowError) {
    if (req && entity) {
      try {
        const actor = actorFromRequest(req);
        audit({ actor, action: "Refuse", functionId: FN, entity, entityId: req.params.id, result: "REFUSED", motif: e.message });
      } catch {
        /* identity missing */
      }
    }
    return res.status(e.status).json({ error: e.message });
  }
  console.error(e);
  res.status(500).json({ error: "Erreur interne." });
}
