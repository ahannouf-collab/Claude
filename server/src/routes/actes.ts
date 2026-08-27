import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const actesRouter = Router();
actesRouter.use(requireAuth);

const acteSchema = z.object({
  code: z.string().optional().nullable().transform((v) => v ?? null),
  libelle: z.string().min(1),
  categorie: z.enum(["Consultation", "Acte technique", "Analyse", "Autre"]).default("Consultation"),
  tarif: z.number().nonnegative().default(0),
  duree_minutes: z.number().int().positive().default(30),
});

actesRouter.get("/", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM actes WHERE actif = 1 ORDER BY categorie, libelle`).all());
});

actesRouter.post("/", (req, res) => {
  const parsed = acteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO actes (code, libelle, categorie, tarif, duree_minutes) VALUES (@code, @libelle, @categorie, @tarif, @duree_minutes)`
    )
    .run(d);
  res.status(201).json({ id: info.lastInsertRowid });
});

actesRouter.put("/:id", (req, res) => {
  const parsed = acteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  db.prepare(
    `UPDATE actes SET code=@code, libelle=@libelle, categorie=@categorie, tarif=@tarif, duree_minutes=@duree_minutes WHERE id=@id`
  ).run({ ...d, id: req.params.id });
  res.json({ ok: true });
});

actesRouter.delete("/:id", (req, res) => {
  db.prepare(`UPDATE actes SET actif = 0 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
