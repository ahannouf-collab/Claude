import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api, ApiError } from "../api";
import { formatDate } from "../constants";

type Consultation = {
  id: number;
  patient_id: number;
  medecin_id: number | null;
  date: string;
  motif: string | null;
  diagnostic: string | null;
  ordonnance: string | null;
  patient_nom: string;
  patient_prenom: string;
  medecin_nom: string | null;
};

type Patient = { id: number; nom: string; prenom: string; telephone: string };
type Medecin = { id: number; full_name: string; specialite: string | null };

const emptyForm = {
  patient_id: "",
  medecin_id: "",
  date: new Date().toISOString().slice(0, 10),
  motif: "",
  poids_kg: "",
  taille_cm: "",
  tension: "",
  temperature: "",
  examen_clinique: "",
  diagnostic: "",
  traitement: "",
  ordonnance: "",
  observations: "",
  prochain_rdv: "",
};

export default function ConsultationsPage() {
  const [searchParams] = useSearchParams();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setConsultations(await api.get<Consultation[]>("/consultations"));
  }

  useEffect(() => {
    load();
    api.get<Medecin[]>("/auth/medecins").then(setMedecins);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Patient[]>(`/patients?q=${encodeURIComponent(patientSearch)}`).then(setPatients);
    }, 200);
    return () => clearTimeout(t);
  }, [patientSearch]);

  useEffect(() => {
    const patientId = searchParams.get("patient_id");
    if (patientId) {
      setForm((f) => ({ ...f, patient_id: patientId }));
      setShowForm(true);
    }
  }, [searchParams]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openForm() {
    setForm(emptyForm);
    setPatientSearch("");
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id) {
      setError("Veuillez sélectionner un patient");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.post("/consultations", {
        patient_id: Number(form.patient_id),
        medecin_id: form.medecin_id ? Number(form.medecin_id) : null,
        date: form.date,
        motif: form.motif || null,
        poids_kg: form.poids_kg ? Number(form.poids_kg) : null,
        taille_cm: form.taille_cm ? Number(form.taille_cm) : null,
        tension: form.tension || null,
        temperature: form.temperature ? Number(form.temperature) : null,
        examen_clinique: form.examen_clinique || null,
        diagnostic: form.diagnostic || null,
        traitement: form.traitement || null,
        ordonnance: form.ordonnance || null,
        observations: form.observations || null,
        prochain_rdv: form.prochain_rdv || null,
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Consultations"
        actions={
          <button className="btn btn-primary" onClick={openForm}>
            + Nouvelle consultation
          </button>
        }
      />
      <div className="content">
        <div className="card" style={{ padding: 0 }}>
          {consultations.length === 0 ? (
            <div className="empty-state">Aucune consultation enregistrée.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Motif</th>
                  <th>Diagnostic</th>
                  <th>Médecin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.date)}</td>
                    <td>
                      {c.patient_prenom} {c.patient_nom.toUpperCase()}
                    </td>
                    <td>{c.motif || "-"}</td>
                    <td>{c.diagnostic || "-"}</td>
                    <td>{c.medecin_nom || "-"}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={async () => setViewing(await api.get(`/consultations/${c.id}`))}
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Nouvelle consultation" onClose={() => setShowForm(false)} width={720}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Patient *</label>
                <input placeholder="Rechercher un patient…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                <select required value={form.patient_id} onChange={(e) => updateField("patient_id", e.target.value)} style={{ marginTop: 6 }}>
                  <option value="">Sélectionner un patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom.toUpperCase()} — {p.telephone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Médecin</label>
                <select value={form.medecin_id} onChange={(e) => updateField("medecin_id", e.target.value)}>
                  <option value="">Non assigné</option>
                  {medecins.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Motif de consultation</label>
                <input value={form.motif} onChange={(e) => updateField("motif", e.target.value)} />
              </div>

              <div className="form-field">
                <label>Poids (kg)</label>
                <input type="number" step="0.1" value={form.poids_kg} onChange={(e) => updateField("poids_kg", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Taille (cm)</label>
                <input type="number" step="0.1" value={form.taille_cm} onChange={(e) => updateField("taille_cm", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Tension artérielle</label>
                <input placeholder="12/8" value={form.tension} onChange={(e) => updateField("tension", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Température (°C)</label>
                <input type="number" step="0.1" value={form.temperature} onChange={(e) => updateField("temperature", e.target.value)} />
              </div>

              <div className="form-field full">
                <label>Examen clinique</label>
                <textarea value={form.examen_clinique} onChange={(e) => updateField("examen_clinique", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Diagnostic</label>
                <textarea value={form.diagnostic} onChange={(e) => updateField("diagnostic", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Traitement</label>
                <textarea value={form.traitement} onChange={(e) => updateField("traitement", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Ordonnance</label>
                <textarea placeholder="Un médicament par ligne, avec posologie et durée" value={form.ordonnance} onChange={(e) => updateField("ordonnance", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Observations</label>
                <textarea value={form.observations} onChange={(e) => updateField("observations", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Prochain rendez-vous</label>
                <input type="date" value={form.prochain_rdv} onChange={(e) => updateField("prochain_rdv", e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Consultation du ${formatDate(viewing.date)}`} onClose={() => setViewing(null)} width={640}>
          <div style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>Patient :</strong> {viewing.patient_prenom} {viewing.patient_nom?.toUpperCase()}
            </div>
            {viewing.medecin_nom && (
              <div>
                <strong>Médecin :</strong> {viewing.medecin_nom}
              </div>
            )}
            {viewing.motif && (
              <div>
                <strong>Motif :</strong> {viewing.motif}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {viewing.poids_kg && <span>Poids : {viewing.poids_kg} kg</span>}
              {viewing.taille_cm && <span>Taille : {viewing.taille_cm} cm</span>}
              {viewing.tension && <span>Tension : {viewing.tension}</span>}
              {viewing.temperature && <span>Température : {viewing.temperature} °C</span>}
            </div>
            {viewing.examen_clinique && (
              <div>
                <strong>Examen clinique :</strong>
                <div className="muted">{viewing.examen_clinique}</div>
              </div>
            )}
            {viewing.diagnostic && (
              <div>
                <strong>Diagnostic :</strong>
                <div className="muted">{viewing.diagnostic}</div>
              </div>
            )}
            {viewing.traitement && (
              <div>
                <strong>Traitement :</strong>
                <div className="muted">{viewing.traitement}</div>
              </div>
            )}
            {viewing.ordonnance && (
              <div>
                <strong>Ordonnance :</strong>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  {viewing.ordonnance}
                </pre>
              </div>
            )}
            {viewing.observations && (
              <div>
                <strong>Observations :</strong>
                <div className="muted">{viewing.observations}</div>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Imprimer
            </button>
            <button className="btn btn-primary" onClick={() => setViewing(null)}>
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
