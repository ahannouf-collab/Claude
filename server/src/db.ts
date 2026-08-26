import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.join(__dirname, "..", "data.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
-- ===== Référentiel Tiers/CIF et comptes (source CBS simulée) =====
CREATE TABLE IF NOT EXISTS customer (
  cif TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  segment TEXT NOT NULL,
  branch TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
  account_no TEXT PRIMARY KEY,
  cif TEXT NOT NULL REFERENCES customer(cif),
  product_code TEXT NOT NULL,
  product_label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  book_balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | DORMANT | DESHERENCE | CLOSED
  branch TEXT NOT NULL,
  opened_date TEXT NOT NULL,
  last_movement_date TEXT NOT NULL,
  unavailable INTEGER NOT NULL DEFAULT 0
);

-- ===== Paramètres système (date métier / COB) =====
CREATE TABLE IF NOT EXISTS system_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ===== M01 - BOA.DESH.PARAM : seuils, délais et workflow (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_parameter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parameter_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U', -- U (unauthorized) | A (authorized)
  dormancy_low_days INTEGER NOT NULL,
  dormancy_high_days INTEGER NOT NULL,
  balance_threshold REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  fee_ttc REAL NOT NULL,
  fee_ude REAL NOT NULL,
  valid_from TEXT NOT NULL,
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M02 - BOA.DESH.ELIG : catégories/transactions BANK (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_eligibility_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_code TEXT NOT NULL,
  bank_transaction TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  threshold REAL NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M02 - comptes indisponibles (exclus du traitement automatique, justifiés) =====
CREATE TABLE IF NOT EXISTS desh_unavailable_account (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_no TEXT NOT NULL,
  reason TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Dossier d'éligibilité (calculé par le moteur/batch EOD, tout-ou-rien Tiers/CIF) =====
CREATE TABLE IF NOT EXISTS desh_eligibility_dossier (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cif TEXT NOT NULL,
  business_date TEXT NOT NULL,
  accounts_scope TEXT NOT NULL, -- JSON array of account_no in scope
  max_inactive_days INTEGER NOT NULL,
  total_balance REAL NOT NULL,
  eligibility_status TEXT NOT NULL, -- ELIGIBLE | NOT_ELIGIBLE | PENDING
  reason TEXT,
  batch_ref TEXT NOT NULL,
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cif, business_date)
);

-- ===== M03 - BOA.DESH.N1.WORKLIST : décision agence N1 (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_decision_n1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL REFERENCES desh_eligibility_dossier(id),
  cif TEXT NOT NULL,
  account_no TEXT NOT NULL,
  book_balance REAL NOT NULL,
  inactive_days INTEGER NOT NULL,
  proposal TEXT NOT NULL DEFAULT 'TRANSFER',
  decision TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVE | REJECT | HOLD
  motif TEXT,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M04 - BOA.DESH.N2.WORKLIST : décision back-office N2 (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_decision_n2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_n1_id INTEGER NOT NULL REFERENCES desh_decision_n1(id),
  cif TEXT NOT NULL,
  account_no TEXT NOT NULL,
  book_balance REAL NOT NULL,
  inactive_days INTEGER NOT NULL,
  proposal TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVE | REJECT | HOLD
  motif TEXT,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M05/M06 - BOA.DESH.REACTIVATE / REACT.AUTH : réactivation (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_reactivation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cif TEXT NOT NULL,
  account_no TEXT NOT NULL,
  current_status TEXT NOT NULL,
  reactivation_reason TEXT NOT NULL,
  document_ref TEXT NOT NULL,
  decision TEXT, -- NULL while pending | APPROVE | REJECT
  reject_motif TEXT,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M08 - BOA.DESH.RECON.EXC : anomalies et réconciliation (versionné, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS desh_exception (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_id TEXT NOT NULL UNIQUE,
  cif TEXT NOT NULL,
  account_no TEXT NOT NULL,
  exception_type TEXT NOT NULL,
  owner TEXT NOT NULL,
  cycle_status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | IN_PROGRESS | RESOLVED
  comment TEXT,
  corrective_action TEXT,
  resolved_ts TEXT,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'U',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M09 - BOA.DESH.EOD.DASHBOARD : historique des exécutions batch (append-only) =====
CREATE TABLE IF NOT EXISTS desh_batch_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date TEXT NOT NULL,
  ran_ts TEXT NOT NULL DEFAULT (datetime('now')),
  triggered_by TEXT NOT NULL,
  eligible_customers INTEGER NOT NULL,
  pending_n1 INTEGER NOT NULL,
  pending_n2 INTEGER NOT NULL,
  reactivations INTEGER NOT NULL,
  exceptions_open INTEGER NOT NULL,
  dossiers_created INTEGER NOT NULL,
  decisions_created INTEGER NOT NULL
);

-- ===== Journal d'audit — append-only =====
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL, -- Create | Save | Authorize | Delete | Reject | Reactivate | Reverse | Consult | Export | RunBatch
  function_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  result TEXT NOT NULL DEFAULT 'SUCCESS', -- SUCCESS | REFUSED
  correlation_id TEXT NOT NULL,
  motif TEXT
);
`);
