import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email et mot de passe requis" });
    return;
  }
  const { email, password } = parsed.data;
  const user = db
    .prepare(`SELECT * FROM users WHERE email = ? AND actif = 1`)
    .get(email) as any;
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
  });
  res.json({
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      specialite: user.specialite,
    },
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare(`SELECT id, full_name, email, role, specialite, telephone FROM users WHERE id = ?`)
    .get(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  res.json(user);
});

const createUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "medecin", "secretaire"]),
  specialite: z.string().optional(),
  telephone: z.string().optional(),
});

// Création réservée à l'admin (le premier compte est créé par le seed).
authRouter.post("/users", requireAuth, requireRole("admin"), (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const data = parsed.data;
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(data.email);
  if (existing) {
    res.status(409).json({ error: "Un utilisateur avec cet email existe déjà" });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, role, specialite, telephone)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(data.full_name, data.email, hashPassword(data.password), data.role, data.specialite ?? null, data.telephone ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

authRouter.get("/users", requireAuth, requireRole("admin"), (_req, res) => {
  const users = db
    .prepare(`SELECT id, full_name, email, role, specialite, telephone, actif, created_ts FROM users ORDER BY full_name`)
    .all();
  res.json(users);
});

authRouter.patch("/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  const fields: string[] = [];
  const values: any[] = [];
  for (const key of ["full_name", "email", "role", "specialite", "telephone", "actif"]) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (body.password) {
    fields.push("password_hash = ?");
    values.push(hashPassword(body.password));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "Aucune donnée à mettre à jour" });
    return;
  }
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Liste des médecins pour les sélecteurs (RDV, consultations) — accessible à tout le personnel connecté.
authRouter.get("/medecins", requireAuth, (_req, res) => {
  const medecins = db
    .prepare(`SELECT id, full_name, specialite FROM users WHERE role = 'medecin' AND actif = 1 ORDER BY full_name`)
    .all();
  res.json(medecins);
});
