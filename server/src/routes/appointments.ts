import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

const appointmentSchema = z.object({
  patient_id: z.number().int(),
  medecin_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  acte_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  date: z.string().min(1),
  heure: z.string().min(1),
  duree_minutes: z.number().int().positive().default(30),
  motif: z.string().optional().nullable().transform((v) => v ?? null),
  statut: z.enum(["planifie", "confirme", "termine", "annule", "absent"]).default("planifie"),
  notes: z.string().optional().nullable().transform((v) => v ?? null),
});

const selectWithJoins = `
  SELECT a.*, p.nom AS patient_nom, p.prenom AS patient_prenom, p.telephone AS patient_telephone,
         u.full_name AS medecin_nom, ac.libelle AS acte_libelle
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN users u ON u.id = a.medecin_id
  LEFT JOIN actes ac ON ac.id = a.acte_id
`;

appointmentsRouter.get("/", (req, res) => {
  const { date, from, to, patient_id, medecin_id } = req.query;
  const clauses: string[] = [];
  const params: any[] = [];
  if (date) {
    clauses.push("a.date = ?");
    params.push(date);
  }
  if (from) {
    clauses.push("a.date >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("a.date <= ?");
    params.push(to);
  }
  if (patient_id) {
    clauses.push("a.patient_id = ?");
    params.push(patient_id);
  }
  if (medecin_id) {
    clauses.push("a.medecin_id = ?");
    params.push(medecin_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`${selectWithJoins} ${where} ORDER BY a.date, a.heure`).all(...params);
  res.json(rows);
});

appointmentsRouter.get("/:id", (req, res) => {
  const row = db.prepare(`${selectWithJoins} WHERE a.id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Rendez-vous introuvable" });
    return;
  }
  res.json(row);
});

appointmentsRouter.post("/", (req, res) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO appointments (patient_id, medecin_id, acte_id, date, heure, duree_minutes, motif, statut, notes)
       VALUES (@patient_id, @medecin_id, @acte_id, @date, @heure, @duree_minutes, @motif, @statut, @notes)`
    )
    .run(d);
  res.status(201).json({ id: info.lastInsertRowid });
});

appointmentsRouter.put("/:id", (req, res) => {
  const parsed = appointmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const existing = db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Rendez-vous introuvable" });
    return;
  }
  const merged = { ...existing, ...parsed.data, id: req.params.id };
  db.prepare(
    `UPDATE appointments SET patient_id=@patient_id, medecin_id=@medecin_id, acte_id=@acte_id, date=@date,
     heure=@heure, duree_minutes=@duree_minutes, motif=@motif, statut=@statut, notes=@notes,
     updated_ts=datetime('now') WHERE id=@id`
  ).run(merged);
  res.json({ ok: true });
});

appointmentsRouter.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM appointments WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
