import { Router } from "express";
import { db } from "../db.js";

export const m2Router = Router();

// M2 - Consultation - Active Account Events (read-only, RG-M2-06: no mutation)
m2Router.get("/:accountNo", (req, res) => {
  const accountNo = req.params.accountNo;
  const account = db.prepare(`SELECT * FROM customer_account WHERE account_no = ?`).get(accountNo);
  if (!account) return res.status(404).json({ error: "Account/RIB introuvable (RG-M2-02)." });

  const events = db
    .prepare(
      `SELECT e.event_code AS event, ec.domain AS domain, e.pose_date, e.case_dossier, e.source,
              c.contribution
       FROM evt_compte e
       JOIN ref_event_code ec ON ec.event_code = e.event_code AND ec.is_current = 1
       LEFT JOIN mcl_restriction_contrib c ON c.event_code = e.event_code AND c.is_current = 1 AND c.status = 'AUTHORIZED'
       WHERE e.account_no = ? AND e.active = 1
       ORDER BY e.pose_date DESC`
    )
    .all(accountNo);

  res.json({ account, events });
});
