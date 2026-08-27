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
-- ===== Utilisateurs du cabinet =====
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'secretaire', -- admin | medecin | secretaire
  specialite TEXT,               -- pour un médecin (ex: Médecine générale, Pédiatrie...)
  telephone TEXT,
  actif INTEGER NOT NULL DEFAULT 1,
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Patients =====
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  cin TEXT,
  date_naissance TEXT,
  sexe TEXT NOT NULL DEFAULT 'M', -- M | F
  telephone TEXT NOT NULL,
  email TEXT,
  adresse TEXT,
  ville TEXT,
  mutuelle TEXT NOT NULL DEFAULT 'Aucune', -- CNSS | CNOPS | AMO | Privée | Aucune
  numero_mutuelle TEXT,
  groupe_sanguin TEXT,
  allergies TEXT,
  antecedents TEXT,
  contact_urgence_nom TEXT,
  contact_urgence_tel TEXT,
  notes TEXT,
  actif INTEGER NOT NULL DEFAULT 1,
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Actes médicaux & tarifs (en MAD) =====
CREATE TABLE IF NOT EXISTS actes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  libelle TEXT NOT NULL,
  categorie TEXT NOT NULL DEFAULT 'Consultation', -- Consultation | Acte technique | Analyse | Autre
  tarif REAL NOT NULL DEFAULT 0,
  duree_minutes INTEGER NOT NULL DEFAULT 30,
  actif INTEGER NOT NULL DEFAULT 1,
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Rendez-vous =====
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medecin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acte_id INTEGER REFERENCES actes(id) ON DELETE SET NULL,
  date TEXT NOT NULL,     -- YYYY-MM-DD
  heure TEXT NOT NULL,    -- HH:MM
  duree_minutes INTEGER NOT NULL DEFAULT 30,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'planifie', -- planifie | confirme | termine | annule | absent
  notes TEXT,
  rappel_envoye INTEGER NOT NULL DEFAULT 0,
  created_ts TEXT NOT NULL DEFAULT (datetime('now')),
  updated_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Consultations (dossier médical) =====
CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medecin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  motif TEXT,
  poids_kg REAL,
  taille_cm REAL,
  tension TEXT,
  temperature REAL,
  examen_clinique TEXT,
  diagnostic TEXT,
  traitement TEXT,
  ordonnance TEXT,
  observations TEXT,
  prochain_rdv TEXT,
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== Facturation =====
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
  medecin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  montant_total REAL NOT NULL DEFAULT 0,
  montant_paye REAL NOT NULL DEFAULT 0,
  mode_paiement TEXT NOT NULL DEFAULT 'especes', -- especes | carte | virement | mutuelle | cheque
  statut TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | payee | partielle | annulee
  prise_en_charge_mutuelle INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  acte_id INTEGER REFERENCES actes(id) ON DELETE SET NULL,
  libelle TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_nom ON patients(nom, prenom);
`);
