import { Router } from "express";
import { db } from "../db.js";
import { actorFromRequest, audit, WorkflowError } from "../workflow.js";

const FN = "BOA.DESH.CIF.INQUIRY";

export const m07Router = Router();

m07Router.get("/inquiry", (req, res) => {
  try {
    const actor = actorFromRequest(req);
    const cif = String(req.query.cif ?? "").trim();
    const accountNo = String(req.query.account ?? "").trim();
    if (!cif) throw new WorkflowError("Customer/CIF est un critère de consultation obligatoire.");

    const customer = db.prepare(`SELECT * FROM customer WHERE cif = ?`).get(cif);
    if (!customer) throw new WorkflowError("Tiers/CIF introuvable.", 404);

    const accounts = accountNo
      ? db.prepare(`SELECT * FROM account WHERE cif = ? AND account_no LIKE ?`).all(cif, `%${accountNo}%`)
      : db.prepare(`SELECT * FROM account WHERE cif = ?`).all(cif);

    const dossiers = db.prepare(`SELECT * FROM desh_eligibility_dossier WHERE cif = ? ORDER BY business_date DESC`).all(cif);
    const decisionsN1 = db.prepare(`SELECT * FROM desh_decision_n1 WHERE cif = ? ORDER BY created_ts DESC`).all(cif);
    const decisionsN2 = db.prepare(`SELECT * FROM desh_decision_n2 WHERE cif = ? ORDER BY created_ts DESC`).all(cif);
    const reactivations = db.prepare(`SELECT * FROM desh_reactivation WHERE cif = ? ORDER BY created_ts DESC`).all(cif);
    const exceptions = db.prepare(`SELECT * FROM desh_exception WHERE cif = ? ORDER BY created_ts DESC`).all(cif);

    // RG-06 : les consultations sensibles sont auditées.
    audit({ actor, action: "Consult", functionId: FN, entity: "customer", entityId: cif });

    res.json({
      customer,
      accounts,
      dossiers,
      decisionsN1,
      decisionsN2,
      reactivations,
      exceptions,
      lastUpdate: new Date().toISOString().replace("T", " ").slice(0, 19),
    });
  } catch (e) {
    if (e instanceof WorkflowError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Erreur interne." });
  }
});
