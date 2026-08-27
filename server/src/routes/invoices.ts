import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

const itemSchema = z.object({
  acte_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  libelle: z.string().min(1),
  quantite: z.number().int().positive().default(1),
  prix_unitaire: z.number().nonnegative().default(0),
});

const invoiceSchema = z.object({
  patient_id: z.number().int(),
  consultation_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  medecin_id: z.number().int().optional().nullable().transform((v) => v ?? null),
  date: z.string().optional(),
  mode_paiement: z.enum(["especes", "carte", "virement", "mutuelle", "cheque"]).default("especes"),
  montant_paye: z.number().nonnegative().default(0),
  prise_en_charge_mutuelle: z.boolean().default(false),
  notes: z.string().optional().nullable().transform((v) => v ?? null),
  items: z.array(itemSchema).min(1),
});

function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM invoices WHERE numero LIKE ?`)
    .get(`FAC-${year}-%`) as { c: number };
  const seq = String(row.c + 1).padStart(4, "0");
  return `FAC-${year}-${seq}`;
}

function statutFromMontants(total: number, paye: number): string {
  if (paye <= 0) return "en_attente";
  if (paye >= total) return "payee";
  return "partielle";
}

const selectWithJoins = `
  SELECT i.*, p.nom AS patient_nom, p.prenom AS patient_prenom, u.full_name AS medecin_nom
  FROM invoices i
  JOIN patients p ON p.id = i.patient_id
  LEFT JOIN users u ON u.id = i.medecin_id
`;

invoicesRouter.get("/", (req, res) => {
  const { patient_id, statut, from, to } = req.query;
  const clauses: string[] = [];
  const params: any[] = [];
  if (patient_id) {
    clauses.push("i.patient_id = ?");
    params.push(patient_id);
  }
  if (statut) {
    clauses.push("i.statut = ?");
    params.push(statut);
  }
  if (from) {
    clauses.push("i.date >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("i.date <= ?");
    params.push(to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  res.json(db.prepare(`${selectWithJoins} ${where} ORDER BY i.date DESC, i.id DESC`).all(...params));
});

invoicesRouter.get("/:id", (req, res) => {
  const invoice = db.prepare(`${selectWithJoins} WHERE i.id = ?`).get(req.params.id);
  if (!invoice) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(req.params.id);
  res.json({ ...invoice, items });
});

invoicesRouter.post("/", (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const d = parsed.data;
  const total = d.items.reduce((sum, it) => sum + it.quantite * it.prix_unitaire, 0);
  const statut = statutFromMontants(total, d.montant_paye);
  const numero = nextInvoiceNumber();

  const insertInvoice = db.prepare(
    `INSERT INTO invoices (numero, patient_id, consultation_id, medecin_id, date, montant_total, montant_paye,
      mode_paiement, statut, prise_en_charge_mutuelle, notes)
     VALUES (@numero, @patient_id, @consultation_id, @medecin_id, COALESCE(@date, date('now')), @montant_total,
      @montant_paye, @mode_paiement, @statut, @prise_en_charge_mutuelle, @notes)`
  );
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (invoice_id, acte_id, libelle, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    const info = insertInvoice.run({
      numero,
      patient_id: d.patient_id,
      consultation_id: d.consultation_id ?? null,
      medecin_id: d.medecin_id ?? null,
      date: d.date ?? null,
      montant_total: total,
      montant_paye: d.montant_paye,
      mode_paiement: d.mode_paiement,
      statut,
      prise_en_charge_mutuelle: d.prise_en_charge_mutuelle ? 1 : 0,
      notes: d.notes ?? null,
    });
    const invoiceId = info.lastInsertRowid as number;
    for (const item of d.items) {
      insertItem.run(invoiceId, item.acte_id ?? null, item.libelle, item.quantite, item.prix_unitaire);
    }
    return invoiceId;
  });

  const id = tx();
  res.status(201).json({ id, numero, montant_total: total, statut });
});

const paymentSchema = z.object({
  montant_paye: z.number().nonnegative(),
  mode_paiement: z.enum(["especes", "carte", "virement", "mutuelle", "cheque"]).optional(),
});

invoicesRouter.patch("/:id/paiement", (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Données invalides" });
    return;
  }
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id) as any;
  if (!invoice) {
    res.status(404).json({ error: "Facture introuvable" });
    return;
  }
  const statut = statutFromMontants(invoice.montant_total, parsed.data.montant_paye);
  db.prepare(
    `UPDATE invoices SET montant_paye = ?, mode_paiement = COALESCE(?, mode_paiement), statut = ? WHERE id = ?`
  ).run(parsed.data.montant_paye, parsed.data.mode_paiement ?? null, statut, req.params.id);
  res.json({ ok: true, statut });
});

invoicesRouter.patch("/:id/annuler", (req, res) => {
  db.prepare(`UPDATE invoices SET statut = 'annulee' WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});
