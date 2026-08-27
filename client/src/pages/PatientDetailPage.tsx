import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api } from "../api";
import { age, formatDate, formatMAD } from "../constants";
import { STATUTS_RDV, STATUTS_FACTURE } from "../constants";

type Patient = {
  id: number;
  nom: string;
  prenom: string;
  cin: string | null;
  date_naissance: string | null;
  sexe: "M" | "F";
  telephone: string;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  mutuelle: string;
  numero_mutuelle: string | null;
  groupe_sanguin: string | null;
  allergies: string | null;
  antecedents: string | null;
  contact_urgence_nom: string | null;
  contact_urgence_tel: string | null;
  notes: string | null;
};

type Historique = {
  consultations: Array<{ id: number; date: string; motif: string | null; diagnostic: string | null; medecin_nom?: string }>;
  rendezvous: Array<{ id: number; date: string; heure: string; statut: string; motif: string | null }>;
  factures: Array<{ id: number; numero: string; date: string; montant_total: number; montant_paye: number; statut: string }>;
};

const TABS = ["Fiche patient", "Consultations", "Rendez-vous", "Facturation"] as const;

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [historique, setHistorique] = useState<Historique | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Fiche patient");

  useEffect(() => {
    api.get<Patient>(`/patients/${id}`).then(setPatient);
    api.get<Historique>(`/patients/${id}/historique`).then(setHistorique);
  }, [id]);

  if (!patient) {
    return (
      <>
        <PageHeader title="Dossier patient" />
        <div className="content">Chargement…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${patient.prenom} ${patient.nom.toUpperCase()}`}
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/patients")}>
            ← Retour à la liste
          </button>
        }
      />
      <div className="content">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Fiche patient" && (
          <div className="grid grid-2">
            <div className="card">
              <div className="section-title">Informations générales</div>
              <Info label="CIN" value={patient.cin} />
              <Info label="Date de naissance" value={`${formatDate(patient.date_naissance)} (${age(patient.date_naissance)})`} />
              <Info label="Sexe" value={patient.sexe === "M" ? "Homme" : "Femme"} />
              <Info label="Téléphone" value={patient.telephone} />
              <Info label="Email" value={patient.email} />
              <Info label="Adresse" value={patient.adresse} />
              <Info label="Ville" value={patient.ville} />
            </div>
            <div className="card">
              <div className="section-title">Couverture & informations médicales</div>
              <Info label="Mutuelle" value={patient.mutuelle} />
              <Info label="N° immatriculation" value={patient.numero_mutuelle} />
              <Info label="Groupe sanguin" value={patient.groupe_sanguin} />
              <Info label="Allergies" value={patient.allergies} />
              <Info label="Antécédents" value={patient.antecedents} />
              <Info label="Contact d'urgence" value={patient.contact_urgence_nom ? `${patient.contact_urgence_nom} — ${patient.contact_urgence_tel}` : null} />
              <Info label="Notes" value={patient.notes} />
            </div>
          </div>
        )}

        {tab === "Consultations" && (
          <div className="card" style={{ padding: 0 }}>
            {!historique || historique.consultations.length === 0 ? (
              <div className="empty-state">Aucune consultation enregistrée.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Motif</th>
                    <th>Diagnostic</th>
                    <th>Médecin</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.consultations.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.date)}</td>
                      <td>{c.motif || "-"}</td>
                      <td>{c.diagnostic || "-"}</td>
                      <td>{c.medecin_nom || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ padding: 14 }}>
              <Link className="btn btn-primary btn-sm" to={`/consultations?patient_id=${patient.id}`}>
                + Nouvelle consultation
              </Link>
            </div>
          </div>
        )}

        {tab === "Rendez-vous" && (
          <div className="card" style={{ padding: 0 }}>
            {!historique || historique.rendezvous.length === 0 ? (
              <div className="empty-state">Aucun rendez-vous enregistré.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Motif</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.rendezvous.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.heure}</td>
                      <td>{r.motif || "-"}</td>
                      <td>
                        <span className="badge" style={{ background: STATUTS_RDV[r.statut]?.color }}>
                          {STATUTS_RDV[r.statut]?.label ?? r.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "Facturation" && (
          <div className="card" style={{ padding: 0 }}>
            {!historique || historique.factures.length === 0 ? (
              <div className="empty-state">Aucune facture enregistrée.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payé</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.factures.map((f) => (
                    <tr key={f.id}>
                      <td>{f.numero}</td>
                      <td>{formatDate(f.date)}</td>
                      <td>{formatMAD(f.montant_total)}</td>
                      <td>{formatMAD(f.montant_paye)}</td>
                      <td>
                        <span className="badge" style={{ background: STATUTS_FACTURE[f.statut]?.color }}>
                          {STATUTS_FACTURE[f.statut]?.label ?? f.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value || "-"}</span>
    </div>
  );
}
