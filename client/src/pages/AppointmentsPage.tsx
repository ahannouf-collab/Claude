import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api, ApiError } from "../api";
import { STATUTS_RDV, formatDate } from "../constants";

type Appointment = {
  id: number;
  patient_id: number;
  medecin_id: number | null;
  acte_id: number | null;
  date: string;
  heure: string;
  duree_minutes: number;
  motif: string | null;
  statut: string;
  notes: string | null;
  patient_nom: string;
  patient_prenom: string;
  patient_telephone: string;
  medecin_nom: string | null;
  acte_libelle: string | null;
};

type Patient = { id: number; nom: string; prenom: string; telephone: string };
type Medecin = { id: number; full_name: string; specialite: string | null };
type Acte = { id: number; libelle: string; tarif: number; duree_minutes: number };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  patient_id: "",
  medecin_id: "",
  acte_id: "",
  date: todayIso(),
  heure: "09:00",
  duree_minutes: 30,
  motif: "",
  statut: "planifie",
  notes: "",
};

export default function AppointmentsPage() {
  const [date, setDate] = useState(todayIso());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  async function load() {
    const rows = await api.get<Appointment[]>(`/appointments?date=${date}`);
    setAppointments(rows);
  }

  useEffect(() => {
    load();
  }, [date]);

  useEffect(() => {
    api.get<Medecin[]>("/auth/medecins").then(setMedecins);
    api.get<Acte[]>("/actes").then(setActes);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Patient[]>(`/patients?q=${encodeURIComponent(patientSearch)}`).then(setPatients);
    }, 200);
    return () => clearTimeout(t);
  }, [patientSearch]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openForm() {
    setForm({ ...emptyForm, date });
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
      const selectedActe = actes.find((a) => a.id === Number(form.acte_id));
      await api.post("/appointments", {
        patient_id: Number(form.patient_id),
        medecin_id: form.medecin_id ? Number(form.medecin_id) : null,
        acte_id: form.acte_id ? Number(form.acte_id) : null,
        date: form.date,
        heure: form.heure,
        duree_minutes: selectedActe?.duree_minutes ?? form.duree_minutes,
        motif: form.motif || null,
        statut: form.statut,
        notes: form.notes || null,
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatut(id: number, statut: string) {
    await api.put(`/appointments/${id}`, { statut });
    load();
  }

  function shiftDate(days: number) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <>
      <PageHeader
        title="Rendez-vous"
        actions={
          <button className="btn btn-primary" onClick={openForm}>
            + Nouveau rendez-vous
          </button>
        }
      />
      <div className="content">
        <div className="toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(-1)}>
              ← Veille
            </button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(1)}>
              Lendemain →
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDate(todayIso())}>
              Aujourd'hui
            </button>
          </div>
          <div className="muted">{formatDate(date)}</div>
        </div>

        <div className="day-calendar">
          {appointments.length === 0 ? (
            <div className="card empty-state">Aucun rendez-vous ce jour.</div>
          ) : (
            appointments.map((a) => (
              <div className="slot-row" key={a.id}>
                <div className="time">{a.heure}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.patient_prenom} {a.patient_nom.toUpperCase()}
                    <span className="muted" style={{ fontWeight: 400 }}> — {a.patient_telephone}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {a.motif || "Consultation"} {a.medecin_nom ? `· ${a.medecin_nom}` : ""} {a.acte_libelle ? `· ${a.acte_libelle}` : ""} · {a.duree_minutes} min
                  </div>
                </div>
                <span className="badge" style={{ background: STATUTS_RDV[a.statut]?.color }}>
                  {STATUTS_RDV[a.statut]?.label ?? a.statut}
                </span>
                <select value={a.statut} onChange={(e) => changeStatut(a.id, e.target.value)} style={{ width: 140 }}>
                  {Object.entries(STATUTS_RDV).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Nouveau rendez-vous" onClose={() => setShowForm(false)} width={620}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Patient *</label>
                <input
                  placeholder="Rechercher un patient…"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                <select
                  required
                  value={form.patient_id}
                  onChange={(e) => updateField("patient_id", e.target.value)}
                  style={{ marginTop: 6 }}
                >
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
                      {m.full_name} {m.specialite ? `(${m.specialite})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Type d'acte</label>
                <select value={form.acte_id} onChange={(e) => updateField("acte_id", e.target.value)}>
                  <option value="">Non spécifié</option>
                  {actes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.libelle} ({a.tarif} DH)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Date *</label>
                <input type="date" required value={form.date} onChange={(e) => updateField("date", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Heure *</label>
                <input type="time" required value={form.heure} onChange={(e) => updateField("heure", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Motif</label>
                <input value={form.motif} onChange={(e) => updateField("motif", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
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
    </>
  );
}
