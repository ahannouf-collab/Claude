import { db } from "./db.js";
import { runEodBatch } from "./engine.js";

const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

const BUSINESS_DATE = "2026-08-10";

export function seedIfEmpty() {
  if (count("customer") > 0) return;

  db.prepare(`INSERT INTO system_setting (key, value) VALUES ('business_date', ?)`).run(BUSINESS_DATE);

  const insertCustomer = db.prepare(`INSERT INTO customer (cif, full_name, segment, branch) VALUES (?, ?, ?, ?)`);
  const insertAccount = db.prepare(`
    INSERT INTO account (account_no, cif, product_code, product_label, currency, book_balance, status, branch, opened_date, last_movement_date)
    VALUES (@account_no, @cif, @product_code, @product_label, @currency, @book_balance, @status, @branch, @opened_date, @last_movement_date)
  `);

  // ----- Population synthétique (traitée par le moteur/batch EOD) -----
  const synthetic: { cif: string; name: string; segment: string; branch: string; accounts: any[] }[] = [
    {
      cif: "10011203",
      name: "Fatima Zahra Bennis",
      segment: "PARTICULIER",
      branch: "001",
      accounts: [
        { account_no: "001010001120", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 15230.5, status: "DORMANT", opened_date: "2005-03-11", last_movement_date: "2015-02-02" },
      ],
    },
    {
      cif: "10018844",
      name: "Youssef Idrissi",
      segment: "PARTICULIER",
      branch: "002",
      accounts: [
        { account_no: "001020004481", product_code: "EPARGNE", product_label: "Compte Épargne", currency: "MAD", book_balance: 890.0, status: "DORMANT", opened_date: "2009-07-20", last_movement_date: "2016-09-14" },
      ],
    },
    {
      cif: "10022190",
      name: "SARL Négoce Atlantique",
      segment: "ENTREPRISE",
      branch: "001",
      accounts: [
        { account_no: "001010007733", product_code: "CHQ", product_label: "Compte Chèque", currency: "MAD", book_balance: 45210.0, status: "DORMANT", opened_date: "2012-01-15", last_movement_date: "2014-06-01" },
      ],
    },
    {
      cif: "10029965",
      name: "Amina Toumi",
      segment: "PARTICULIER",
      branch: "003",
      accounts: [
        { account_no: "001030002210", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 320.0, status: "DORMANT", opened_date: "2010-05-05", last_movement_date: "2011-04-01" },
      ],
    },
    {
      cif: "10037781",
      name: "Rachid Ouahbi",
      segment: "PARTICULIER",
      branch: "002",
      accounts: [
        { account_no: "001020009944", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 6100.75, status: "ACTIVE", opened_date: "2020-01-10", last_movement_date: "2026-07-28" },
      ],
    },
    {
      cif: "10041256",
      name: "Société Al Bahr Import-Export",
      segment: "ENTREPRISE",
      branch: "001",
      accounts: [
        { account_no: "001010003390", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 78900.0, status: "DORMANT", opened_date: "2007-11-02", last_movement_date: "2013-03-19" },
      ],
    },
    {
      cif: "10048833",
      name: "Nadia Cherkaoui",
      segment: "PARTICULIER",
      branch: "004",
      accounts: [
        { account_no: "001040005567", product_code: "EPARGNE", product_label: "Compte Épargne", currency: "MAD", book_balance: 2200.0, status: "DORMANT", opened_date: "2008-08-08", last_movement_date: "2012-12-20" },
      ],
    },
    {
      cif: "10052147",
      name: "Hassan Benkirane",
      segment: "PARTICULIER",
      branch: "003",
      accounts: [
        { account_no: "001030007712", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 410.2, status: "DORMANT", opened_date: "2006-02-14", last_movement_date: "2010-10-05" },
      ],
    },
    {
      cif: "10059920",
      name: "Leila Amrani",
      segment: "PARTICULIER",
      branch: "002",
      accounts: [
        { account_no: "001020001183", product_code: "CASA", product_label: "Compte sur Carnet", currency: "MAD", book_balance: 9800.0, status: "DORMANT", opened_date: "2014-04-04", last_movement_date: "2019-01-11" },
      ],
    },
  ];

  for (const c of synthetic) {
    insertCustomer.run(c.cif, c.name, c.segment, c.branch);
    for (const a of c.accounts) insertAccount.run({ cif: c.cif, branch: c.branch, ...a });
  }

  // Compte gelé / réservé légal — sera déclaré indisponible en M02 (exclu du batch).
  insertCustomer.run("10063412", "Karim Lahlou", "PARTICULIER", "001");
  insertAccount.run({
    account_no: "001010009120",
    cif: "10063412",
    product_code: "CASA",
    product_label: "Compte sur Carnet",
    currency: "MAD",
    book_balance: 54000.0,
    status: "DORMANT",
    branch: "001",
    opened_date: "2004-06-01",
    last_movement_date: "2012-05-19",
  });

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const paramMaker = "PARAM.MAKER1";
  const paramChecker = "PARAM.CHECKER1";

  // ----- M01 - Paramétrage seuils, délais et workflow (autorisé) -----
  db.prepare(
    `INSERT INTO desh_parameter (parameter_code, version, is_current, status, dormancy_low_days, dormancy_high_days, balance_threshold, currency, fee_ttc, fee_ude, valid_from, maker, maker_ts, checker, checker_ts, last_action)
     VALUES ('BOA.DESH.PARAM', 1, 1, 'A', 2555, 3650, 500.00, 'MAD', 165.00, 82.50, ?, ?, ?, ?, ?, 'Authorize')`
  ).run(BUSINESS_DATE, paramMaker, now, paramChecker, now);

  // ----- M02 - Catégories/transactions BANK autorisées -----
  const insertRule = db.prepare(
    `INSERT INTO desh_eligibility_rule (category_code, bank_transaction, currency, threshold, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
     VALUES (?, ?, 'MAD', 500.00, 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
  );
  insertRule.run("CASA", "DESH.TRANSFER", paramMaker, now, paramChecker, now);
  insertRule.run("EPARGNE", "DESH.TRANSFER", paramMaker, now, paramChecker, now);

  // Un draft non autorisé pour illustrer le workflow M02.
  db.prepare(
    `INSERT INTO desh_eligibility_rule (category_code, bank_transaction, currency, threshold, version, is_current, status, maker, maker_ts, last_action)
     VALUES ('CHQ', 'DESH.TRANSFER', 'MAD', 1000.00, 1, 1, 'U', ?, ?, 'New')`
  ).run(paramMaker, now);

  // Compte indisponible (réserve légale) — exclu du traitement automatique.
  db.prepare(
    `INSERT INTO desh_unavailable_account (account_no, reason, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
     VALUES ('001010009120', 'Réserve légale — saisie-arrêt en cours (réf. TGI-2026-0143)', 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
  ).run(paramMaker, now, paramChecker, now);

  // ----- Exécution du batch EOD sur la population synthétique -----
  runEodBatch(BUSINESS_DATE, "SYSTEM.BATCH");

  // ----- Dossiers "vitrine" repris des exemples de la SFD (mockups M03/M04/M05/M06/M07) -----
  const agenceMaker = "AGENCE.MAKER1";
  const agenceChecker = "AGENCE.CHECKER1";
  const boMaker = "BO.MAKER1";
  const boChecker = "BO.CHECKER1";
  const reactMaker = "REACT.MAKER1";
  const reconOwner = "RECON.OWNER1";
  const reconSupervisor = "RECON.SUPERVISOR1";

  // Hero A — CIF 10024591 / compte 001010003456 : dossier éligible en attente de décision N1 (exemple SFD M03/M07).
  insertCustomer.run("10024591", "Mohamed Fassi Fihri", "PARTICULIER", "001");
  insertAccount.run({
    account_no: "001010003456",
    cif: "10024591",
    product_code: "CASA",
    product_label: "Compte sur Carnet",
    currency: "MAD",
    book_balance: 12480.0,
    status: "DORMANT",
    branch: "001",
    opened_date: "2003-04-12",
    last_movement_date: "2018-11-19",
  });
  const dossierA = db
    .prepare(
      `INSERT INTO desh_eligibility_dossier (cif, business_date, accounts_scope, max_inactive_days, total_balance, eligibility_status, reason, batch_ref)
       VALUES ('10024591', ?, '["001010003456"]', 2812, 12480.00, 'ELIGIBLE', NULL, 'EOD-SHOWCASE')`
    )
    .run(BUSINESS_DATE);
  db.prepare(
    `INSERT INTO desh_decision_n1 (dossier_id, cif, account_no, book_balance, inactive_days, proposal, decision, version, is_current, status, last_action)
     VALUES (?, '10024591', '001010003456', 12480.00, 2812, 'TRANSFER', 'PENDING', 1, 1, 'U', 'New')`
  ).run(dossierA.lastInsertRowid);

  // Hero B — dossier avec décision N1 déjà autorisée (APPROVE) : alimente la worklist N2 (M04).
  insertCustomer.run("10031177", "Samira Bouzid", "PARTICULIER", "002");
  insertAccount.run({
    account_no: "001020009981",
    cif: "10031177",
    product_code: "CASA",
    product_label: "Compte sur Carnet",
    currency: "MAD",
    book_balance: 9340.6,
    status: "DORMANT",
    branch: "002",
    opened_date: "2002-09-01",
    last_movement_date: "2016-01-05",
  });
  const dossierB = db
    .prepare(
      `INSERT INTO desh_eligibility_dossier (cif, business_date, accounts_scope, max_inactive_days, total_balance, eligibility_status, reason, batch_ref)
       VALUES ('10031177', ?, '["001020009981"]', 3870, 9340.60, 'ELIGIBLE', NULL, 'EOD-SHOWCASE')`
    )
    .run(BUSINESS_DATE);
  const n1B = db
    .prepare(
      `INSERT INTO desh_decision_n1 (dossier_id, cif, account_no, book_balance, inactive_days, proposal, decision, motif, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
       VALUES (?, '10031177', '001020009981', 9340.60, 3870, 'TRANSFER', 'APPROVE', 'Dossier complet, éligibilité confirmée en agence.', 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
    )
    .run(dossierB.lastInsertRowid, agenceMaker, now, agenceChecker, now);
  db.prepare(
    `INSERT INTO desh_decision_n2 (decision_n1_id, cif, account_no, book_balance, inactive_days, proposal, decision, version, is_current, status, last_action)
     VALUES (?, '10031177', '001020009981', 9340.60, 3870, 'TRANSFER', 'PENDING', 1, 1, 'U', 'New')`
  ).run(n1B.lastInsertRowid);

  // Hero C — workflow N1+N2 complet et autorisé : le compte est basculé en DESHERENCE, prêt pour une demande de réactivation (M05/M06).
  insertCustomer.run("10045320", "Abdelilah Sabri", "PARTICULIER", "003");
  insertAccount.run({
    account_no: "001030004477",
    cif: "10045320",
    product_code: "CASA",
    product_label: "Compte sur Carnet",
    currency: "MAD",
    book_balance: 3120.0,
    status: "DESHERENCE",
    branch: "003",
    opened_date: "2001-02-18",
    last_movement_date: "2014-03-02",
  });
  const dossierC = db
    .prepare(
      `INSERT INTO desh_eligibility_dossier (cif, business_date, accounts_scope, max_inactive_days, total_balance, eligibility_status, reason, batch_ref)
       VALUES ('10045320', ?, '["001030004477"]', 4544, 3120.00, 'ELIGIBLE', NULL, 'EOD-SHOWCASE')`
    )
    .run(BUSINESS_DATE);
  const n1C = db
    .prepare(
      `INSERT INTO desh_decision_n1 (dossier_id, cif, account_no, book_balance, inactive_days, proposal, decision, motif, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
       VALUES (?, '10045320', '001030004477', 3120.00, 4544, 'TRANSFER', 'APPROVE', 'Confirmé en agence après recherche client infructueuse.', 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
    )
    .run(dossierC.lastInsertRowid, agenceMaker, now, agenceChecker, now);
  db.prepare(
    `INSERT INTO desh_decision_n2 (decision_n1_id, cif, account_no, book_balance, inactive_days, proposal, decision, motif, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
     VALUES (?, '10045320', '001030004477', 3120.00, 4544, 'TRANSFER', 'APPROVE', 'Validation finale back-office — transfert déshérence déclenché.', 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
  ).run(n1C.lastInsertRowid, boMaker, now, boChecker, now);

  // ----- M05/M06 - Demande de réactivation en attente d'autorisation (exemple SFD) -----
  db.prepare(
    `INSERT INTO desh_reactivation (cif, account_no, current_status, reactivation_reason, document_ref, version, is_current, status, maker, maker_ts, last_action)
     VALUES ('10045320', '001030004477', 'DESHERENCE', 'CUSTOMER REQUEST', 'GED://DESH/2026/881', 1, 1, 'U', ?, ?, 'New')`
  ).run(reactMaker, now);

  // ----- M08 - Anomalies et réconciliation -----
  db.prepare(
    `INSERT INTO desh_exception (exception_id, cif, account_no, exception_type, owner, cycle_status, version, is_current, status, maker, maker_ts, last_action)
     VALUES ('EXC-2026-0042', '10031177', '001020009981', 'STATUS_MISMATCH', 'CBS.SUPPORT', 'OPEN', 1, 1, 'U', ?, ?, 'New')`
  ).run(reconOwner, now);
  db.prepare(
    `INSERT INTO desh_exception (exception_id, cif, account_no, exception_type, owner, cycle_status, comment, corrective_action, version, is_current, status, maker, maker_ts, last_action)
     VALUES ('EXC-2026-0038', '10041256', '001010003390', 'BALANCE_DRIFT', 'CBS.SUPPORT', 'IN_PROGRESS', 'Écart de rapprochement en cours d''analyse avec le CBS.', 'Rejeu de la commutation prévu.', 1, 1, 'U', ?, ?, 'Save')`
  ).run(reconOwner, now);
  db.prepare(
    `INSERT INTO desh_exception (exception_id, cif, account_no, exception_type, owner, cycle_status, comment, corrective_action, resolved_ts, version, is_current, status, maker, maker_ts, checker, checker_ts, last_action)
     VALUES ('EXC-2026-0021', '10018844', '001020004481', 'DUPLICATE_DOSSIER', 'CBS.SUPPORT', 'RESOLVED', 'Doublon technique identifié suite à un rejeu de batch.', 'Dossier en double clôturé, conservation de la version d''origine.', ?, 1, 1, 'A', ?, ?, ?, ?, 'Authorize')`
  ).run(now, reconOwner, now, reconSupervisor, now);
}
