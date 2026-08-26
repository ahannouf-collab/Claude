import { db } from "./db.js";
import { getCurrent } from "./workflow.js";

interface AccountRow {
  account_no: string;
  cif: string;
  product_code: string;
  currency: string;
  book_balance: number;
  status: string;
  branch: string;
  opened_date: string;
  last_movement_date: string;
}

function daysBetween(from: string, to: string) {
  const d1 = new Date(from + "T00:00:00Z").getTime();
  const d2 = new Date(to + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
}

/**
 * Moteur d'éligibilité et batch EOD (M09 - Pilotage batch et KPI).
 * Applique le principe "tout ou rien Tiers/CIF" (RG M01) : l'éligibilité est
 * évaluée sur le périmètre complet des comptes disponibles du CIF, en
 * excluant les comptes déclarés indisponibles (M02) et en s'appuyant sur le
 * paramétrage autorisé courant (M01) et les catégories/transactions BANK
 * autorisées (M02). Idempotent pour une même date métier (pas de doublon).
 */
export function runEodBatch(businessDate: string, triggeredBy: string) {
  const param = getCurrent("desh_parameter", ["parameter_code"], ["BOA.DESH.PARAM"]) as
    | Record<string, unknown>
    | undefined;
  if (!param || param.status !== "A") {
    throw new Error("Aucun paramétrage M01 autorisé — le batch ne peut pas s'exécuter (RG-03).");
  }

  const unavailable = new Set(
    (
      db
        .prepare(`SELECT account_no FROM desh_unavailable_account WHERE status = 'A' AND is_current = 1`)
        .all() as { account_no: string }[]
    ).map((r) => r.account_no)
  );
  const allowedCategories = new Set(
    (
      db.prepare(`SELECT DISTINCT category_code FROM desh_eligibility_rule WHERE status = 'A' AND is_current = 1`).all() as {
        category_code: string;
      }[]
    ).map((r) => r.category_code)
  );

  const batchRef = `EOD-${businessDate}-${Date.now()}`;
  const customers = db.prepare(`SELECT cif FROM customer`).all() as { cif: string }[];

  let dossiersCreated = 0;
  let decisionsCreated = 0;

  const insertDossier = db.prepare(
    `INSERT INTO desh_eligibility_dossier (cif, business_date, accounts_scope, max_inactive_days, total_balance, eligibility_status, reason, batch_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDecisionN1 = db.prepare(
    `INSERT INTO desh_decision_n1 (dossier_id, cif, account_no, book_balance, inactive_days, proposal, decision, version, is_current, status, last_action)
     VALUES (?, ?, ?, ?, ?, 'TRANSFER', 'PENDING', 1, 1, 'U', 'New')`
  );

  for (const { cif } of customers) {
    const existingDossier = db
      .prepare(`SELECT id FROM desh_eligibility_dossier WHERE cif = ? AND business_date = ?`)
      .get(cif, businessDate);
    if (existingDossier) continue; // idempotent retry

    const accounts = db
      .prepare(`SELECT * FROM account WHERE cif = ? AND status != 'CLOSED'`)
      .all(cif) as AccountRow[];
    if (accounts.length === 0) continue;

    const scope = accounts.filter((a) => !unavailable.has(a.account_no));
    if (scope.length === 0) continue; // tous les comptes indisponibles -> exclus, justifiés en M02

    const withInactivity = scope.map((a) => ({ account: a, days: daysBetween(a.last_movement_date, businessDate) }));
    const maxInactive = Math.max(...withInactivity.map((x) => x.days));
    const totalBalance = scope.reduce((s, a) => s + a.book_balance, 0);
    const categoryOk = scope.every((a) => allowedCategories.has(a.product_code));

    let status: "ELIGIBLE" | "NOT_ELIGIBLE" | "PENDING";
    let reason: string | null = null;
    const low = param.dormancy_low_days as number;
    const high = param.dormancy_high_days as number;
    const threshold = param.balance_threshold as number;

    if (!categoryOk) {
      status = "NOT_ELIGIBLE";
      reason = "Catégorie de produit non couverte par une transaction BANK autorisée (M02).";
    } else if (maxInactive < low) {
      status = "NOT_ELIGIBLE";
      reason = "Inactivité inférieure au seuil bas (dormancy low days).";
    } else if (totalBalance < threshold) {
      status = "NOT_ELIGIBLE";
      reason = "Solde cumulé inférieur au seuil de balance paramétré.";
    } else if (maxInactive >= high) {
      status = "ELIGIBLE";
    } else {
      status = "PENDING";
      reason = "Inactivité entre les seuils low/high — supervision requise avant décision.";
    }

    const info = insertDossier.run(
      cif,
      businessDate,
      JSON.stringify(scope.map((a) => a.account_no)),
      maxInactive,
      totalBalance,
      status,
      reason,
      batchRef
    );
    dossiersCreated++;

    if (status === "ELIGIBLE") {
      const lead = [...withInactivity].sort((a, b) => b.days - a.days)[0];
      insertDecisionN1.run(info.lastInsertRowid, cif, lead.account.account_no, lead.account.book_balance, lead.days);
      decisionsCreated++;
    }
  }

  const kpis = computeKpis(businessDate);
  db.prepare(
    `INSERT INTO desh_batch_run (business_date, triggered_by, eligible_customers, pending_n1, pending_n2, reactivations, exceptions_open, dossiers_created, decisions_created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    businessDate,
    triggeredBy,
    kpis.eligibleCustomers,
    kpis.pendingN1,
    kpis.pendingN2,
    kpis.reactivationsToday,
    kpis.exceptionsOpen,
    dossiersCreated,
    decisionsCreated
  );

  return { batchRef, dossiersCreated, decisionsCreated, kpis };
}

export function computeKpis(businessDate: string) {
  const eligibleCustomers = (
    db
      .prepare(`SELECT COUNT(DISTINCT cif) c FROM desh_eligibility_dossier WHERE business_date = ? AND eligibility_status = 'ELIGIBLE'`)
      .get(businessDate) as { c: number }
  ).c;
  const pendingN1 = (db.prepare(`SELECT COUNT(*) c FROM desh_decision_n1 WHERE status = 'U' AND is_current = 1`).get() as { c: number }).c;
  const pendingN2 = (db.prepare(`SELECT COUNT(*) c FROM desh_decision_n2 WHERE status = 'U' AND is_current = 1`).get() as { c: number }).c;
  const reactivationsToday = (
    db
      .prepare(`SELECT COUNT(*) c FROM desh_reactivation WHERE status = 'A' AND is_current = 1 AND date(checker_ts) = date(?)`)
      .get(businessDate) as { c: number }
  ).c;
  const exceptionsOpen = (
    db.prepare(`SELECT COUNT(*) c FROM desh_exception WHERE cycle_status != 'RESOLVED' AND is_current = 1`).get() as { c: number }
  ).c;
  return { eligibleCustomers, pendingN1, pendingN2, reactivationsToday, exceptionsOpen };
}
