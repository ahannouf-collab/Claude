import { Router } from "express";
import { db } from "../db.js";

export const m3Router = Router();

// M3 - Consultation - Account Event History (read-only, append-only source)
m3Router.get("/:accountNo", (req, res) => {
  const accountNo = req.params.accountNo;
  const { from_date, to_date, event_code } = req.query as Record<string, string | undefined>;
  if (!from_date || !to_date) {
    return res.status(400).json({ error: "From Date et To Date sont obligatoires (RG-M3-01)." });
  }
  if (from_date > to_date) {
    return res.status(400).json({ error: "From Date doit être <= To Date (RG-M3-01)." });
  }
  const account = db.prepare(`SELECT * FROM customer_account WHERE account_no = ?`).get(accountNo);
  if (!account) return res.status(404).json({ error: "Account/RIB introuvable." });

  const params: unknown[] = [accountNo, from_date, to_date];
  let filter = "";
  if (event_code && event_code !== "All") {
    filter = " AND event_code = ?";
    params.push(event_code);
  }
  const history = db
    .prepare(
      `SELECT event_code AS event, pose_date, levee_date, motif, source, archive_ref
       FROM hist_evt_compte
       WHERE account_no = ? AND pose_date >= ? AND pose_date <= ?${filter}
       ORDER BY pose_date DESC`
    )
    .all(...params);

  res.json({ account, history });
});
