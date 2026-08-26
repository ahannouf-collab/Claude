import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, authorizeRecord, deleteUnauthorized, getById, listVersions, saveVersion, WorkflowError } from "../workflow.js";

const TABLE = "desh_parameter";
const KEY = ["parameter_code"];
const FN = "BOA.DESH.PARAM";

export const m01Router = Router();

m01Router.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = q
    ? db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 AND parameter_code LIKE ? ORDER BY parameter_code`).all(`%${q}%`)
    : db.prepare(`SELECT * FROM ${TABLE} WHERE is_current = 1 ORDER BY parameter_code`).all();
  res.json(rows);
});

m01Router.get("/:id", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Paramétrage introuvable." });
  res.json(row);
});

m01Router.get("/:id/versions", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Paramétrage introuvable." });
  res.json(listVersions(TABLE, KEY, [row.parameter_code]));
});

m01Router.get("/:id/audit", (req, res) => {
  const row = getById(TABLE, Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Paramétrage introuvable." });
  res.json(db.prepare(`SELECT * FROM audit_log WHERE entity = 'desh_parameter' AND entity_id = ? ORDER BY ts DESC`).all(row.parameter_code as string));
});

m01Router.post("/", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const { parameter_code, dormancy_low_days, dormancy_high_days, balance_threshold, currency, fee_ttc, fee_ude, valid_from, expectedVersion } =
      req.body ?? {};
    if (!parameter_code || !dormancy_low_days || !dormancy_high_days || !balance_threshold || !valid_from) {
      throw new WorkflowError("Parameter Code, Dormancy low/high days, Balance threshold et Valid From sont obligatoires.");
    }
    if (Number(dormancy_low_days) <= 0 || Number(dormancy_high_days) <= 0) {
      throw new WorkflowError("Dormancy low/high days doivent être des entiers positifs.");
    }
    if (Number(dormancy_low_days) >= Number(dormancy_high_days)) {
      throw new WorkflowError("Dormancy low days doit être strictement inférieur à Dormancy high days.");
    }
    if (Number(balance_threshold) < 0) throw new WorkflowError("Balance threshold doit être positif.");
    const row = saveVersion(
      TABLE,
      KEY,
      [parameter_code],
      {
        dormancy_low_days: Number(dormancy_low_days),
        dormancy_high_days: Number(dormancy_high_days),
        balance_threshold: Number(balance_threshold),
        currency: currency ?? "MAD",
        fee_ttc: Number(fee_ttc ?? 0),
        fee_ude: Number(fee_ude ?? 0),
        valid_from,
      },
      actor.login,
      expectedVersion
    );
    audit({ actor, action: "Save", functionId: FN, entity: TABLE, entityId: parameter_code, after: row });
    res.status(201).json(row);
  } catch (e) {
    handleError(e, res);
  }
});

m01Router.post("/:id/authorize", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const row = authorizeRecord(TABLE, Number(req.params.id), actor.login);
    audit({ actor, action: "Authorize", functionId: FN, entity: TABLE, entityId: (row as any)?.parameter_code, before, after: row });
    res.json(row);
  } catch (e) {
    handleError(e, res, req);
  }
});

m01Router.delete("/:id", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const before = getById(TABLE, Number(req.params.id));
    const result = deleteUnauthorized(TABLE, Number(req.params.id), KEY);
    audit({ actor, action: "Delete", functionId: FN, entity: TABLE, entityId: (before as any)?.parameter_code, before });
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
        /* identity missing — nothing to audit against */
      }
    }
    return res.status(e.status).json({ error: e.message });
  }
  console.error(e);
  res.status(500).json({ error: "Erreur interne." });
}
