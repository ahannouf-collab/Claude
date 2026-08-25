import { db } from "./db.js";

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

export function seedIfEmpty() {
  if (count("ref_event_code") > 0) return;

  const now = new Date().toISOString();
  const maker = "TPOSIG01";
  const checker = "TPOSIG02";

  const insertEvent = db.prepare(`
    INSERT INTO ref_event_code (event_code, version, is_current, status, description, domain, event_status, maker, maker_ts, checker, checker_ts, last_action)
    VALUES (@event_code, 1, 1, 'AUTHORIZED', @description, @domain, 'Active', @maker, @ts, @checker, @ts, 'Authorize')
  `);
  insertEvent.run({ event_code: "GEL", description: "Avis de gel", domain: "REGULATORY", maker, checker, ts: now });
  insertEvent.run({ event_code: "ATD", description: "Avis à Tiers Détenteur", domain: "LEGAL", maker, checker, ts: now });
  insertEvent.run({ event_code: "DESH", description: "Compte en déshérence", domain: "COMPLIANCE", maker, checker, ts: now });

  const insertReason = db.prepare(`
    INSERT INTO ref_event_reason (event_code, reason_code, version, is_current, status, description, maker, maker_ts, checker, checker_ts, last_action)
    VALUES (@event_code, @reason_code, 1, 1, 'AUTHORIZED', @description, @maker, @ts, @checker, @ts, 'Authorize')
  `);
  const reasonIds: Record<string, number> = {};
  for (const r of [
    { event_code: "GEL", reason_code: "GEL-001", description: "Avis initial" },
    { event_code: "GEL", reason_code: "GEL-002", description: "Renouvellement" },
    { event_code: "ATD", reason_code: "ATD-001", description: "Notification huissier" },
  ]) {
    const info = insertReason.run({ ...r, maker, checker, ts: now });
    reasonIds[r.reason_code] = info.lastInsertRowid as number;
  }
  const insertTranslation = db.prepare(`
    INSERT INTO ref_event_reason_translation (reason_id, language, description, active) VALUES (?, ?, ?, 'Y')
  `);
  insertTranslation.run(reasonIds["GEL-001"], "FR", "Avis initial");
  insertTranslation.run(reasonIds["GEL-001"], "EN", "Freeze notice - initial");
  insertTranslation.run(reasonIds["GEL-002"], "FR", "Renouvellement");
  insertTranslation.run(reasonIds["GEL-002"], "EN", "Freeze notice - renewal");
  insertTranslation.run(reasonIds["ATD-001"], "FR", "Notification huissier");
  insertTranslation.run(reasonIds["ATD-001"], "EN", "Bailiff notification");

  const matrixInfo = db
    .prepare(
      `INSERT INTO ref_sop_event_matrix (sop, effective_from, version, is_current, status, matrix_status, maker, maker_ts, checker, checker_ts, last_action)
       VALUES ('TAG - Transaction Agence', '2026-08-11', 3, 1, 'AUTHORIZED', 'Published', ?, ?, ?, ?, 'Authorize')`
    )
    .run(maker, now, checker, now);
  const matrixId = matrixInfo.lastInsertRowid as number;
  const insertMatrixRow = db.prepare(`
    INSERT INTO sop_matrix_row (matrix_id, event, impact, severity, message, override, active)
    VALUES (?, ?, ?, ?, ?, ?, 'Y')
  `);
  insertMatrixRow.run(matrixId, "GEL", "BLOCK_ALL", 100, "Compte gelé", "N");
  insertMatrixRow.run(matrixId, "ATD", "BLOCK_DEBIT", 80, "Débit interdit", "N");
  insertMatrixRow.run(matrixId, "DESH", "ALERT", 20, "Compte dormant", "Y");

  const insertContrib = db.prepare(`
    INSERT INTO mcl_restriction_contrib (event_code, effective_from, version, is_current, status, contribution, event_active_status, maker, maker_ts, checker, checker_ts, last_action)
    VALUES (@event_code, @effective_from, 1, 1, 'AUTHORIZED', @contribution, 'Active', @maker, @ts, @checker, @ts, 'Authorize')
  `);
  insertContrib.run({ event_code: "GEL", effective_from: "2026-08-05", contribution: "NO_DEBIT_NO_CREDIT", maker, checker, ts: now });
  insertContrib.run({ event_code: "ATD", effective_from: "2026-08-07", contribution: "NO_DEBIT", maker, checker, ts: now });

  const acc1 = "0117800001600100123456";
  const acc2 = "0117800002007890123456";
  db.prepare(
    `INSERT INTO customer_account (account_no, rib, customer_id, customer_name, account_status) VALUES (?, ?, ?, ?, 'OPEN')`
  ).run(acc1, acc1, "000045678", "Société Atlas");
  db.prepare(
    `INSERT INTO customer_account (account_no, rib, customer_id, customer_name, account_status) VALUES (?, ?, ?, ?, 'OPEN')`
  ).run(acc2, acc2, "000078901", "Négoce Sahel SARL");

  const insertEvt = db.prepare(`
    INSERT INTO evt_compte (account_no, event_code, pose_date, case_dossier, source, active) VALUES (?, ?, ?, ?, ?, 1)
  `);
  insertEvt.run(acc1, "GEL", "2026-08-05", "-", "GEL_APP");
  insertEvt.run(acc1, "ATD", "2026-08-07", "ATD-26081", "ATD_APP");

  const insertHist = db.prepare(`
    INSERT INTO hist_evt_compte (account_no, event_code, pose_date, levee_date, motif, source, archive_ref) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertHist.run(acc1, "ATD", "2026-01-05", "2026-01-20", "MAINLEVEE", "ATD_APP", "H-000889");
  insertHist.run(acc1, "GEL", "2026-02-12", "2026-02-25", "MAINLEVEE", "GEL_APP", "H-001032");

  const insertReject = db.prepare(`
    INSERT INTO event_rejection_log (reject_id, ts, source, event_code, code, reject_type, status, retry_count, correlation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertReject.run("RJ-9851", "2026-08-10 22:01:14", "GEL_APP", "GEL", "ERR-REF-005", "Functional", "Open", 0, "COR-0001");
  insertReject.run("RJ-9852", "2026-08-10 22:03:09", "ATD_APP", "ATD", "ERR-REF-009", "Technical", "Investigating", 1, "COR-0002");

  db.prepare(
    `INSERT INTO fcubs_account_restriction (account_no, native_restriction, last_commutation_ts) VALUES (?, ?, ?)`
  ).run(acc1, "NO_DEBIT_NO_CREDIT", "2026-08-10 22:03:10");
  db.prepare(
    `INSERT INTO fcubs_account_restriction (account_no, native_restriction, last_commutation_ts) VALUES (?, ?, ?)`
  ).run(acc2, "NO_DEBIT", "2026-08-10 07:15:40");

  const insertCommutation = db.prepare(`
    INSERT INTO commutation_history (job_ref, account_no, theoretical, fcubs_value, mode, status, retry_count, ts, correlation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCommutation.run("RT-260810-991", acc1, "NO_DEBIT_NO_CREDIT", "NONE", "RT", "Mismatch", 0, "2026-08-10 09:12:00", "COR-9001");
  insertCommutation.run("BAT-260810-07", acc2, "NO_DEBIT", "NO_DEBIT", "Batch", "Corrected", 1, "2026-08-10 07:15:40", "COR-9002");
}
