import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const rdvAujourdhui = (
    db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE date = ? AND statut != 'annule'`).get(today) as any
  ).c;

  const patientsTotal = (db.prepare(`SELECT COUNT(*) AS c FROM patients WHERE actif = 1`).get() as any).c;

  const consultationsMois = (
    db.prepare(`SELECT COUNT(*) AS c FROM consultations WHERE date LIKE ?`).get(`${monthPrefix}%`) as any
  ).c;

  const revenusMois = (
    db
      .prepare(`SELECT COALESCE(SUM(montant_paye), 0) AS s FROM invoices WHERE date LIKE ? AND statut != 'annulee'`)
      .get(`${monthPrefix}%`) as any
  ).s;

  const facturesEnAttente = (
    db.prepare(`SELECT COUNT(*) AS c FROM invoices WHERE statut IN ('en_attente', 'partielle')`).get() as any
  ).c;

  const montantEnAttente = (
    db
      .prepare(
        `SELECT COALESCE(SUM(montant_total - montant_paye), 0) AS s FROM invoices WHERE statut IN ('en_attente', 'partielle')`
      )
      .get() as any
  ).s;

  const prochainRdv = db
    .prepare(
      `SELECT a.id, a.date, a.heure, a.motif, p.nom AS patient_nom, p.prenom AS patient_prenom
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.date = ? AND a.statut NOT IN ('annule', 'termine')
       ORDER BY a.heure LIMIT 10`
    )
    .all(today);

  const repartitionMutuelle = db
    .prepare(`SELECT mutuelle, COUNT(*) AS total FROM patients WHERE actif = 1 GROUP BY mutuelle`)
    .all();

  res.json({
    rdvAujourdhui,
    patientsTotal,
    consultationsMois,
    revenusMois,
    facturesEnAttente,
    montantEnAttente,
    prochainRdv,
    repartitionMutuelle,
  });
});
