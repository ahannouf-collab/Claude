import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const patientsRouter = Router();
patientsRouter.use(requireAuth);

const patientSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  cin: z.string().optional().nullable().transform((v) => v ?? null),
  date_naissance: z.string().optional().nullable().transform((v) => v ?? null),
  sexe: z.enum(["M", "F"]).default("M"),
  telephone: z.string().min(1),
  email: z.string().optional().nullable().transform((v) => v ?? null),
  adresse: z.string().optional().nullable().transform((v) => v ?? null),
  ville: z.string().optional().nullable().transform((v) => v ?? null),
  mutuelle: z.enum(["CNSS", "CNOPS", "AMO", "Privée", "Aucune"]).default("Aucune"),
  numero_mutuelle: z.string().optional().nullable().transform((v) => v ?? null),
  groupe_sanguin: z.string().optional().nullable().transform((v) => v ?? null),
  allergies: z.string().optional().nullable().transform((v) => v ?? null),
  antecedents: z.string().optional().nullable().transform((v) => v ?? null),
  contact_urgence_nom: z.string().optional().nullable().transform((v) => v ?? null),
  contact_urgence_tel: z.string().optional().nullable().transform((v) => v ?? null),
  notes: z.string().optional().nullable().transform((v) => v ?? null),
});

patientsRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT * FROM patients WHERE actif = 1 AND
         (nom LIKE ? OR prenom LIKE ? OR telephone LIKE ? OR cin LIKE ?)
         ORDER BY nom, prenom LIMIT 200`
      )
      .all(like, like, like, like);
  } else {
    rows = db.prepare(`SELECT * FROM patients WHERE actif = 1 ORDER BY nom, prenom LIMIT 200`).all();
  }
  res.json(rows);
});

patientsRouter.get("/:id", (req, res) => {
  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(req.params.id);
  if (!patient) {
    res.status(404).json({ error: "Patient introuvable" });
    return;
  }
  res.json(patient);
});

patientsRouter.get("/:id/historique", (req, res) => {
  const id = req.params.id;
  const consultations = db
    .prepare(`SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC, id DESC`)
    .all(id);
  const rendezvous = db
    .prepare(`SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, heure DESC`)
    .all(id);
  const factures = db
    .prepare(`SELECT * FROM invoices WHERE patient_id = ? ORDER BY date DESC, id DESC`)
    .all(id);
  res.json({ consultations, rendezvous, factures });
});

patientsRouter.post("/", (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO patients (nom, prenom, cin, date_naissance, sexe, telephone, email, adresse, ville,
        mutuelle, numero_mutuelle, groupe_sanguin, allergies, antecedents, contact_urgence_nom, contact_urgence_tel, notes)
       VALUES (@nom, @prenom, @cin, @date_naissance, @sexe, @telephone, @email, @adresse, @ville,
        @mutuelle, @numero_mutuelle, @groupe_sanguin, @allergies, @antecedents, @contact_urgence_nom, @contact_urgence_tel, @notes)`
    )
    .run(d);
  res.status(201).json({ id: info.lastInsertRowid });
});

patientsRouter.put("/:id", (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const existing = db.prepare(`SELECT id FROM patients WHERE id = ?`).get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Patient introuvable" });
    return;
  }
  db.prepare(
    `UPDATE patients SET nom=@nom, prenom=@prenom, cin=@cin, date_naissance=@date_naissance, sexe=@sexe,
     telephone=@telephone, email=@email, adresse=@adresse, ville=@ville, mutuelle=@mutuelle,
     numero_mutuelle=@numero_mutuelle, groupe_sanguin=@groupe_sanguin, allergies=@allergies,
     antecedents=@antecedents, contact_urgence_nom=@contact_urgence_nom, contact_urgence_tel=@contact_urgence_tel,
     notes=@notes, updated_ts=datetime('now') WHERE id=@id`
  ).run({ ...d, id: req.params.id });
  res.json({ ok: true });
});

patientsRouter.delete("/:id", (req, res) => {
  db.prepare(`UPDATE patients SET actif = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
