import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api, ApiError } from "../api";
import { MUTUELLES, VILLES_MAROC, age } from "../constants";

type Patient = {
  id: number;
  nom: string;
  prenom: string;
  cin: string | null;
  date_naissance: string | null;
  sexe: "M" | "F";
  telephone: string;
  ville: string | null;
  mutuelle: string;
};

const emptyForm = {
  nom: "",
  prenom: "",
  cin: "",
  date_naissance: "",
  sexe: "M" as "M" | "F",
  telephone: "",
  email: "",
  adresse: "",
  ville: "",
  mutuelle: "Aucune",
  numero_mutuelle: "",
  groupe_sanguin: "",
  allergies: "",
  antecedents: "",
  contact_urgence_nom: "",
  contact_urgence_tel: "",
  notes: "",
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(q = "") {
    const rows = await api.get<Patient[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setPatients(rows);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  function updateField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/patients", form);
      setShowForm(false);
      setForm(emptyForm);
      load(query);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Patients"
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Nouveau patient
          </button>
        }
      />
      <div className="content">
        <div className="toolbar">
          <div className="search-box">
            <input
              placeholder="Rechercher par nom, téléphone ou CIN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          {patients.length === 0 ? (
            <div className="empty-state">Aucun patient trouvé.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Âge</th>
                  <th>Sexe</th>
                  <th>Téléphone</th>
                  <th>Ville</th>
                  <th>Couverture</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/patients/${p.id}`} style={{ color: "var(--primary-dark)", fontWeight: 600, textDecoration: "none" }}>
                        {p.nom.toUpperCase()} {p.prenom}
                      </Link>
                    </td>
                    <td>{age(p.date_naissance)}</td>
                    <td>{p.sexe === "M" ? "Homme" : "Femme"}</td>
                    <td>{p.telephone}</td>
                    <td>{p.ville || "-"}</td>
                    <td>{p.mutuelle}</td>
                    <td>
                      <Link className="btn btn-secondary btn-sm" to={`/patients/${p.id}`}>
                        Dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Nouveau patient" onClose={() => setShowForm(false)} width={720}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Nom *</label>
                <input required value={form.nom} onChange={(e) => updateField("nom", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Prénom *</label>
                <input required value={form.prenom} onChange={(e) => updateField("prenom", e.target.value)} />
              </div>
              <div className="form-field">
                <label>CIN</label>
                <input value={form.cin} onChange={(e) => updateField("cin", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Date de naissance</label>
                <input type="date" value={form.date_naissance} onChange={(e) => updateField("date_naissance", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Sexe</label>
                <select value={form.sexe} onChange={(e) => updateField("sexe", e.target.value as "M" | "F")}>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </div>
              <div className="form-field">
                <label>Téléphone *</label>
                <input
                  required
                  placeholder="+212 6 12 34 56 78"
                  value={form.telephone}
                  onChange={(e) => updateField("telephone", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Ville</label>
                <select value={form.ville} onChange={(e) => updateField("ville", e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {VILLES_MAROC.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field full">
                <label>Adresse</label>
                <input value={form.adresse} onChange={(e) => updateField("adresse", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Couverture médicale</label>
                <select value={form.mutuelle} onChange={(e) => updateField("mutuelle", e.target.value)}>
                  {MUTUELLES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>N° d'immatriculation mutuelle</label>
                <input value={form.numero_mutuelle} onChange={(e) => updateField("numero_mutuelle", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Groupe sanguin</label>
                <input placeholder="O+, A-, ..." value={form.groupe_sanguin} onChange={(e) => updateField("groupe_sanguin", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Allergies</label>
                <input value={form.allergies} onChange={(e) => updateField("allergies", e.target.value)} />
              </div>
              <div className="form-field full">
                <label>Antécédents médicaux</label>
                <textarea value={form.antecedents} onChange={(e) => updateField("antecedents", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Contact d'urgence — nom</label>
                <input value={form.contact_urgence_nom} onChange={(e) => updateField("contact_urgence_nom", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Contact d'urgence — téléphone</label>
                <input value={form.contact_urgence_tel} onChange={(e) => updateField("contact_urgence_tel", e.target.value)} />
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
