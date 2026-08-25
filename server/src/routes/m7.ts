import { Router } from "express";
import { db } from "../db.js";

export const m7Router = Router();

// M7 - Consultation - Account Events & Global Restriction (read-only; Recalculate is a service call, not a mutation)
function computeGlobalRestriction(accountNo: string) {
  const rows = db
    .prepare(
      `SELECT c.contribution
       FROM evt_compte e
       JOIN mcl_restriction_contrib c ON c.event_code = e.event_code AND c.is_current = 1 AND c.status = 'AUTHORIZED'
       WHERE e.account_no = ? AND e.active = 1`
    )
    .all(accountNo) as { contribution: string }[];
  let noDebit = false;
  let noCredit = false;
  for (const r of rows) {
    if (r.contribution === "NO_DEBIT_NO_CREDIT") {
      noDebit = true;
      noCredit = true;
    } else if (r.contribution === "NO_DEBIT") noDebit = true;
    else if (r.contribution === "NO_CREDIT") noCredit = true;
  }
  if (noDebit && noCredit) return "NO_DEBIT_NO_CREDIT";
  if (noDebit) return "NO_DEBIT";
  if (noCredit) return "NO_CREDIT";
  return "NONE";
}

m7Router.get("/:accountNo", (req, res) => {
  const accountNo = req.params.accountNo;
  const account = db.prepare(`SELECT * FROM customer_account WHERE account_no = ?`).get(accountNo);
  if (!account) return res.status(404).json({ error: "Account/RIB introuvable (RG-M7-01)." });

  const events = db
    .prepare(
      `SELECT e.event_code AS event, c.contribution, e.pose_date, e.source, e.case_dossier AS case_ref
       FROM evt_compte e
       LEFT JOIN mcl_restriction_contrib c ON c.event_code = e.event_code AND c.is_current = 1 AND c.status = 'AUTHORIZED'
       WHERE e.account_no = ? AND e.active = 1
       ORDER BY e.pose_date DESC`
    )
    .all(accountNo);

  const native = db.prepare(`SELECT * FROM fcubs_account_restriction WHERE account_no = ?`).get(accountNo) as
    | { native_restriction: string; last_commutation_ts: string }
    | undefined;

  const globalRestriction = computeGlobalRestriction(accountNo);

  res.json({
    account,
    events,
    global_restriction: globalRestriction,
    native_restriction: native?.native_restriction ?? "NONE",
    last_commutation: native?.last_commutation_ts ?? null,
    mismatch: native ? native.native_restriction !== globalRestriction : false,
  });
});

// Recalculate: appelle le service MCL (simulé) - lecture seule, aucune mutation FCUBS depuis cet écran (RG-M7-06)
m7Router.post("/:accountNo/recalculate", (req, res) => {
  const accountNo = req.params.accountNo;
  const account = db.prepare(`SELECT * FROM customer_account WHERE account_no = ?`).get(accountNo);
  if (!account) return res.status(404).json({ error: "Account/RIB introuvable." });
  const globalRestriction = computeGlobalRestriction(accountNo);
  res.json({ recalculated_restriction: globalRestriction, ts: new Date().toISOString() });
});
