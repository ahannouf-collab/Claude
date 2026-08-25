import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
-- ===== Reference data (LOV sources) =====
CREATE TABLE IF NOT EXISTS customer_account (
  account_no TEXT PRIMARY KEY,
  rib TEXT,
  customer_id TEXT,
  customer_name TEXT,
  account_status TEXT
);

-- ===== M1 - REF_EVENT_CODE (versioned, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS ref_event_code (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | SUBMITTED | AUTHORIZED
  description TEXT NOT NULL,
  domain TEXT NOT NULL,
  event_status TEXT NOT NULL DEFAULT 'Active', -- Active | Inactive
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== M4 - REF_EVENT_REASON (versioned, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS ref_event_reason (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_code TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  description TEXT NOT NULL,
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ref_event_reason_translation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason_id INTEGER NOT NULL REFERENCES ref_event_reason(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  description TEXT NOT NULL,
  active TEXT NOT NULL DEFAULT 'Y'
);

-- ===== M5 - REF_SOP_EVENT_MATRIX (versioned, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS ref_sop_event_matrix (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sop TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- workflow status: DRAFT | SUBMITTED | AUTHORIZED
  matrix_status TEXT NOT NULL DEFAULT 'Draft', -- business status shown on screen: Draft | Published
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_matrix_row (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matrix_id INTEGER NOT NULL REFERENCES ref_sop_event_matrix(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  impact TEXT NOT NULL, -- BLOCK_ALL | BLOCK_DEBIT | ALERT | ALLOW
  severity INTEGER NOT NULL,
  message TEXT NOT NULL,
  override TEXT NOT NULL DEFAULT 'N',
  active TEXT NOT NULL DEFAULT 'Y'
);

-- ===== M8 - MCL_RESTRICTION_CONTRIB (versioned, Maker/Checker) =====
CREATE TABLE IF NOT EXISTS mcl_restriction_contrib (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_code TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  contribution TEXT NOT NULL, -- NO_DEBIT_NO_CREDIT | NO_DEBIT | NO_CREDIT | NONE
  event_active_status TEXT NOT NULL DEFAULT 'Active',
  maker TEXT,
  maker_ts TEXT,
  checker TEXT,
  checker_ts TEXT,
  last_action TEXT NOT NULL DEFAULT 'New',
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== EVT_COMPTE - active account events (consulted by M2/M7) =====
CREATE TABLE IF NOT EXISTS evt_compte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_no TEXT NOT NULL,
  event_code TEXT NOT NULL,
  pose_date TEXT NOT NULL,
  case_dossier TEXT,
  source TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- ===== HIST_EVT_COMPTE - append-only history (M3) =====
CREATE TABLE IF NOT EXISTS hist_evt_compte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_no TEXT NOT NULL,
  event_code TEXT NOT NULL,
  pose_date TEXT NOT NULL,
  levee_date TEXT,
  motif TEXT,
  source TEXT,
  archive_ref TEXT
);

-- ===== EVENT_REJECTION_LOG (M6) =====
CREATE TABLE IF NOT EXISTS event_rejection_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reject_id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL,
  event_code TEXT NOT NULL,
  code TEXT NOT NULL,
  reject_type TEXT NOT NULL DEFAULT 'Functional', -- Functional | Technical
  status TEXT NOT NULL DEFAULT 'Open', -- Open | Investigating | Retried | Closed
  retry_count INTEGER NOT NULL DEFAULT 0,
  correlation_id TEXT
);

-- ===== FCUBS account restriction (native opposable value) =====
CREATE TABLE IF NOT EXISTS fcubs_account_restriction (
  account_no TEXT PRIMARY KEY,
  native_restriction TEXT NOT NULL DEFAULT 'NONE',
  last_commutation_ts TEXT
);

-- ===== COMMUTATION_HISTORY / reconciliation (M9) =====
CREATE TABLE IF NOT EXISTS commutation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_ref TEXT NOT NULL UNIQUE,
  account_no TEXT NOT NULL,
  theoretical TEXT NOT NULL,
  fcubs_value TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'RT', -- RT | Batch
  status TEXT NOT NULL DEFAULT 'Mismatch', -- Mismatch | Corrected | Investigating
  retry_count INTEGER NOT NULL DEFAULT 0,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  correlation_id TEXT
);
`);
