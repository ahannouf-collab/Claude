import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const consultationsRouter = Router();
consultationsRouter.use(requireAuth);

const consultationSchema = z.object({
  patient_id: z.number().int(),
  medecin_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  appointment_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  date: z.string().optional().nullable().transform((v) => v ?? null),
  motif: z.string().optional().nullable().transform((v) => v ?? null),
  poids_kg: z.number().optional().nullable().transform((v) => v ?? null),
  taille_cm: z.number().optional().nullable().transform((v) => v ?? null),
  tension: z.string().optional().nullable().transform((v) => v ?? null),
  temperature: z.number().optional().nullable().transform((v) => v ?? null),
  examen_clinique: z.string().optional().nullable().transform((v) => v ?? null),
  diagnostic: z.string().optional().nullable().transform((v) => v ?? null),
  traitement: z.string().optional().nullable().transform((v) => v ?? null),
  ordonnance: z.string().optional().nullable().transform((v) => v ?? null),
  observations: z.string().optional().nullable().transform((v) => v ?? null),
  prochain_rdv: z.string().optional().nullable().transform((v) => v ?? null),
});

const selectWithJoins = `
  SELECT c.*, p.nom AS patient_nom, p.prenom AS patient_prenom, u.full_name AS medecin_nom
  FROM consultations c
  JOIN patients p ON p.id = c.patient_id
  LEFT JOIN users u ON u.id = c.medecin_id
`;

consultationsRouter.get("/", (req, res) => {
  const { patient_id } = req.query;
  if (patient_id) {
    const rows = db
      .prepare(`${selectWithJoins} WHERE c.patient_id = ? ORDER BY c.date DESC, c.id DESC`)
      .all(patient_id);
    res.json(rows);
    return;
  }
  const rows = db.prepare(`${selectWithJoins} ORDER BY c.date DESC, c.id DESC LIMIT 100`).all();
  res.json(rows);
});

consultationsRouter.get("/:id", (req, res) => {
  const row = db.prepare(`${selectWithJoins} WHERE c.id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Consultation introuvable" });
    return;
  }
  res.json(row);
});

consultationsRouter.post("/", (req, res) => {
  const parsed = consultationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO consultations (patient_id, medecin_id, appointment_id, date, motif, poids_kg, taille_cm,
        tension, temperature, examen_clinique, diagnostic, traitement, ordonnance, observations, prochain_rdv)
       VALUES (@patient_id, @medecin_id, @appointment_id, COALESCE(@date, date('now')), @motif, @poids_kg, @taille_cm,
        @tension, @temperature, @examen_clinique, @diagnostic, @traitement, @ordonnance, @observations, @prochain_rdv)`
    )
    .run(d);

  if (d.appointment_id) {
    db.prepare(`UPDATE appointments SET statut = 'termine' WHERE id = ?`).run(d.appointment_id);
  }

  res.status(201).json({ id: info.lastInsertRowid });
});

consultationsRouter.put("/:id", (req, res) => {
  const parsed = consultationSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const existing = db.prepare(`SELECT * FROM consultations WHERE id = ?`).get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Consultation introuvable" });
    return;
  }
  const merged = { ...existing, ...parsed.data, id: req.params.id };
  db.prepare(
    `UPDATE consultations SET patient_id=@patient_id, medecin_id=@medecin_id, appointment_id=@appointment_id,
     date=@date, motif=@motif, poids_kg=@poids_kg, taille_cm=@taille_cm, tension=@tension, temperature=@temperature,
     examen_clinique=@examen_clinique, diagnostic=@diagnostic, traitement=@traitement, ordonnance=@ordonnance,
     observations=@observations, prochain_rdv=@prochain_rdv WHERE id=@id`
  ).run(merged);
  res.json({ ok: true });
});

consultationsRouter.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM consultations WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
