import { Router } from "express";
import { db } from "../db.js";
import { computeKpis, runEodBatch } from "../engine.js";
import { actorFromRequest, audit, WorkflowError } from "../workflow.js";

const FN = "BOA.DESH.EOD.DASHBOARD";

export const m09Router = Router();

function currentBusinessDate(): string {
  const row = db.prepare(`SELECT value FROM system_setting WHERE key = 'business_date'`).get() as { value: string } | undefined;
  return row?.value ?? new Date().toISOString().slice(0, 10);
}

m09Router.get("/kpis", (req, res) => {
  const businessDate = String(req.query.businessDate ?? currentBusinessDate());
  const kpis = computeKpis(businessDate);
  const lastRun = db.prepare(`SELECT * FROM desh_batch_run WHERE business_date = ? ORDER BY ran_ts DESC LIMIT 1`).get(businessDate);
  res.json({ businessDate, kpis, lastRun });
});

m09Router.get("/runs", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM desh_batch_run ORDER BY ran_ts DESC LIMIT 50`).all());
});

const DRILLDOWNS: Record<string, string> = {
  "eligible-customers": `SELECT cif, business_date, max_inactive_days, total_balance, eligibility_status FROM desh_eligibility_dossier WHERE business_date = ? AND eligibility_status = 'ELIGIBLE' ORDER BY max_inactive_days DESC`,
  "pending-n1": `SELECT cif, account_no, book_balance, inactive_days, proposal, decision FROM desh_decision_n1 WHERE status = 'U' AND is_current = 1 ORDER BY inactive_days DESC`,
  "pending-n2": `SELECT cif, account_no, book_balance, inactive_days, proposal, decision FROM desh_decision_n2 WHERE status = 'U' AND is_current = 1 ORDER BY inactive_days DESC`,
  reactivations: `SELECT cif, account_no, reactivation_reason, decision, checker_ts FROM desh_reactivation WHERE status = 'A' AND is_current = 1 AND date(checker_ts) = date(?) ORDER BY checker_ts DESC`,
  exceptions: `SELECT exception_id, cif, account_no, exception_type, owner, cycle_status FROM desh_exception WHERE cycle_status != 'RESOLVED' AND is_current = 1 ORDER BY created_ts DESC`,
};

m09Router.get("/drilldown/:kpi", (req, res) => {
  const sql = DRILLDOWNS[req.params.kpi];
  if (!sql) return res.status(404).json({ error: "Indicateur inconnu." });
  const businessDate = String(req.query.businessDate ?? currentBusinessDate());
  const needsDate = req.params.kpi === "eligible-customers" || req.params.kpi === "reactivations";
  const rows = needsDate ? db.prepare(sql).all(businessDate) : db.prepare(sql).all();
  res.json(rows);
});

m09Router.post("/run", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const businessDate = String(req.body?.businessDate ?? currentBusinessDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new WorkflowError("Business Date invalide (format YYYY-MM-DD attendu).");
    const result = runEodBatch(businessDate, actor.login);
    db.prepare(`INSERT INTO system_setting (key, value) VALUES ('business_date', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
      businessDate
    );
    audit({ actor, action: "RunBatch", functionId: FN, entity: "desh_batch_run", entityId: businessDate, after: result });
    res.status(201).json(result);
  } catch (e) {
    if (e instanceof WorkflowError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: (e as Error).message ?? "Erreur interne." });
  }
});
