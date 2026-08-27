import { db } from "./db.js";
import { hashPassword } from "./lib/auth.js";

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

export function seedIfEmpty() {
  if (count("users") > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, specialite, telephone)
    VALUES (@full_name, @email, @password_hash, @role, @specialite, @telephone)
  `);

  insertUser.run({
    full_name: "Dr. Yasmine Alaoui",
    email: "admin@cabinet.ma",
    password_hash: hashPassword("admin123"),
    role: "admin",
    specialite: "Médecine générale",
    telephone: "+212 6 61 23 45 67",
  });
  const medecin2 = insertUser.run({
    full_name: "Dr. Karim Bennani",
    email: "k.bennani@cabinet.ma",
    password_hash: hashPassword("medecin123"),
    role: "medecin",
    specialite: "Pédiatrie",
    telephone: "+212 6 62 34 56 78",
  });
  insertUser.run({
    full_name: "Sanae El Fassi",
    email: "secretariat@cabinet.ma",
    password_hash: hashPassword("secretaire123"),
    role: "secretaire",
    specialite: null,
    telephone: "+212 6 63 45 67 89",
  });

  const medecinId = 1;
  const pediatreId = medecin2.lastInsertRowid as number;

  const insertActe = db.prepare(`
    INSERT INTO actes (code, libelle, categorie, tarif, duree_minutes) VALUES (@code, @libelle, @categorie, @tarif, @duree_minutes)
  `);
  const actes = [
    { code: "CG", libelle: "Consultation générale", categorie: "Consultation", tarif: 200, duree_minutes: 20 },
    { code: "CS", libelle: "Consultation spécialiste", categorie: "Consultation", tarif: 300, duree_minutes: 30 },
    { code: "CP", libelle: "Consultation pédiatrique", categorie: "Consultation", tarif: 250, duree_minutes: 25 },
    { code: "VAC", libelle: "Vaccination", categorie: "Acte technique", tarif: 150, duree_minutes: 15 },
    { code: "ECG", libelle: "Électrocardiogramme", categorie: "Acte technique", tarif: 180, duree_minutes: 20 },
    { code: "PANS", libelle: "Pansement", categorie: "Acte technique", tarif: 80, duree_minutes: 15 },
    { code: "CERT", libelle: "Certificat médical", categorie: "Autre", tarif: 100, duree_minutes: 10 },
  ];
  const acteIds: Record<string, number> = {};
  for (const a of actes) {
    const info = insertActe.run(a);
    acteIds[a.code!] = info.lastInsertRowid as number;
  }

  const insertPatient = db.prepare(`
    INSERT INTO patients (nom, prenom, cin, date_naissance, sexe, telephone, email, adresse, ville, mutuelle,
      numero_mutuelle, groupe_sanguin, allergies, antecedents, contact_urgence_nom, contact_urgence_tel, notes)
    VALUES (@nom, @prenom, @cin, @date_naissance, @sexe, @telephone, @email, @adresse, @ville, @mutuelle,
      @numero_mutuelle, @groupe_sanguin, @allergies, @antecedents, @contact_urgence_nom, @contact_urgence_tel, @notes)
  `);
  const patients = [
    {
      nom: "Tazi",
      prenom: "Mohammed",
      cin: "BE482915",
      date_naissance: "1985-03-12",
      sexe: "M",
      telephone: "+212 6 12 34 56 78",
      email: "m.tazi@gmail.com",
      adresse: "12 Rue des Orangers",
      ville: "Casablanca",
      mutuelle: "CNSS",
      numero_mutuelle: "CN-778451",
      groupe_sanguin: "O+",
      allergies: "Pénicilline",
      antecedents: "Hypertension artérielle",
      contact_urgence_nom: "Fatima Tazi",
      contact_urgence_tel: "+212 6 98 76 54 32",
      notes: null,
    },
    {
      nom: "Benjelloun",
      prenom: "Salma",
      cin: "A305218",
      date_naissance: "1992-07-25",
      sexe: "F",
      telephone: "+212 6 23 45 67 89",
      email: "salma.bj@gmail.com",
      adresse: "45 Avenue Hassan II",
      ville: "Rabat",
      mutuelle: "CNOPS",
      numero_mutuelle: "CP-114523",
      groupe_sanguin: "A+",
      allergies: null,
      antecedents: null,
      contact_urgence_nom: "Omar Benjelloun",
      contact_urgence_tel: "+212 6 11 22 33 44",
      notes: null,
    },
    {
      nom: "El Amrani",
      prenom: "Youssef",
      cin: "J152487",
      date_naissance: "2018-11-02",
      sexe: "M",
      telephone: "+212 6 34 56 78 90",
      email: null,
      adresse: "7 Rue Ibn Khaldoun",
      ville: "Marrakech",
      mutuelle: "AMO",
      numero_mutuelle: "AM-990211",
      groupe_sanguin: null,
      allergies: "Arachides",
      antecedents: "Asthme",
      contact_urgence_nom: "Nadia El Amrani",
      contact_urgence_tel: "+212 6 55 66 77 88",
      notes: "Patient suivi par Dr. Bennani",
    },
    {
      nom: "Cherkaoui",
      prenom: "Amine",
      cin: "K220987",
      date_naissance: "1978-01-30",
      sexe: "M",
      telephone: "+212 6 45 67 89 01",
      email: "a.cherkaoui@outlook.com",
      adresse: "23 Boulevard Zerktouni",
      ville: "Fès",
      mutuelle: "Privée",
      numero_mutuelle: "SAHAM-56231",
      groupe_sanguin: "B+",
      allergies: null,
      antecedents: "Diabète type 2",
      contact_urgence_nom: null,
      contact_urgence_tel: null,
      notes: null,
    },
    {
      nom: "Idrissi",
      prenom: "Khadija",
      cin: "EE98452",
      date_naissance: "1999-09-14",
      sexe: "F",
      telephone: "+212 6 56 78 90 12",
      email: "khadija.idrissi@gmail.com",
      adresse: "3 Rue Allal Ben Abdellah",
      ville: "Tanger",
      mutuelle: "Aucune",
      numero_mutuelle: null,
      groupe_sanguin: "AB-",
      allergies: null,
      antecedents: null,
      contact_urgence_nom: "Hassan Idrissi",
      contact_urgence_tel: "+212 6 99 88 77 66",
      notes: null,
    },
  ];
  const patientIds: number[] = [];
  for (const p of patients) {
    const info = insertPatient.run(p);
    patientIds.push(info.lastInsertRowid as number);
  }

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = fmt(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const insertAppt = db.prepare(`
    INSERT INTO appointments (patient_id, medecin_id, acte_id, date, heure, duree_minutes, motif, statut, notes)
    VALUES (@patient_id, @medecin_id, @acte_id, @date, @heure, @duree_minutes, @motif, @statut, @notes)
  `);
  const appts = [
    { patient_id: patientIds[0], medecin_id: medecinId, acte_id: acteIds.CG, date: todayStr, heure: "09:00", duree_minutes: 20, motif: "Contrôle tension artérielle", statut: "confirme", notes: null },
    { patient_id: patientIds[1], medecin_id: medecinId, acte_id: acteIds.CG, date: todayStr, heure: "09:30", duree_minutes: 20, motif: "Consultation générale", statut: "planifie", notes: null },
    { patient_id: patientIds[2], medecin_id: pediatreId, acte_id: acteIds.CP, date: todayStr, heure: "10:30", duree_minutes: 25, motif: "Suivi asthme", statut: "planifie", notes: null },
    { patient_id: patientIds[3], medecin_id: medecinId, acte_id: acteIds.CS, date: fmt(tomorrow), heure: "11:00", duree_minutes: 30, motif: "Bilan diabète", statut: "planifie", notes: null },
    { patient_id: patientIds[4], medecin_id: medecinId, acte_id: acteIds.CG, date: fmt(tomorrow), heure: "15:00", duree_minutes: 20, motif: "Première consultation", statut: "planifie", notes: null },
  ];
  const apptIds: number[] = [];
  for (const a of appts) {
    const info = insertAppt.run(a);
    apptIds.push(info.lastInsertRowid as number);
  }

  const insertConsult = db.prepare(`
    INSERT INTO consultations (patient_id, medecin_id, appointment_id, date, motif, poids_kg, taille_cm, tension,
      temperature, examen_clinique, diagnostic, traitement, ordonnance, observations, prochain_rdv)
    VALUES (@patient_id, @medecin_id, @appointment_id, @date, @motif, @poids_kg, @taille_cm, @tension,
      @temperature, @examen_clinique, @diagnostic, @traitement, @ordonnance, @observations, @prochain_rdv)
  `);
  const consultInfo = insertConsult.run({
    patient_id: patientIds[0],
    medecin_id: medecinId,
    appointment_id: null,
    date: fmt(new Date(today.getTime() - 30 * 86400000)),
    motif: "Contrôle tension artérielle",
    poids_kg: 82,
    taille_cm: 175,
    tension: "14/9",
    temperature: 36.8,
    examen_clinique: "Patient asymptomatique, auscultation cardio-pulmonaire normale",
    diagnostic: "Hypertension artérielle modérée",
    traitement: "Amlodipine 5mg 1cp/jour",
    ordonnance: "Amlodipine 5mg - 1 comprimé par jour pendant 30 jours\nRégime hyposodé",
    observations: "Bonne tolérance, à revoir dans 1 mois",
    prochain_rdv: todayStr,
  });

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (numero, patient_id, consultation_id, medecin_id, date, montant_total, montant_paye,
      mode_paiement, statut, prise_en_charge_mutuelle, notes)
    VALUES (@numero, @patient_id, @consultation_id, @medecin_id, @date, @montant_total, @montant_paye,
      @mode_paiement, @statut, @prise_en_charge_mutuelle, @notes)
  `);
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, acte_id, libelle, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)
  `);
  const year = today.getFullYear();
  const inv1 = insertInvoice.run({
    numero: `FAC-${year}-0001`,
    patient_id: patientIds[0],
    consultation_id: consultInfo.lastInsertRowid,
    medecin_id: medecinId,
    date: fmt(new Date(today.getTime() - 30 * 86400000)),
    montant_total: 200,
    montant_paye: 200,
    mode_paiement: "especes",
    statut: "payee",
    prise_en_charge_mutuelle: 1,
    notes: null,
  });
  insertItem.run(inv1.lastInsertRowid, acteIds.CG, "Consultation générale", 1, 200);

  const inv2 = insertInvoice.run({
    numero: `FAC-${year}-0002`,
    patient_id: patientIds[3],
    consultation_id: null,
    medecin_id: medecinId,
    date: todayStr,
    montant_total: 380,
    montant_paye: 0,
    mode_paiement: "mutuelle",
    statut: "en_attente",
    prise_en_charge_mutuelle: 0,
    notes: "En attente de règlement",
  });
  insertItem.run(inv2.lastInsertRowid, acteIds.CS, "Consultation spécialiste", 1, 300);
  insertItem.run(inv2.lastInsertRowid, acteIds.ECG, "Électrocardiogramme", 1, 80);
}
