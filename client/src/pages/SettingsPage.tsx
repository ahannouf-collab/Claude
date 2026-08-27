import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { SPECIALITES, formatMAD } from "../constants";

type Acte = {
  id: number;
  code: string | null;
  libelle: string;
  categorie: string;
  tarif: number;
  duree_minutes: number;
};

type UserRow = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  specialite: string | null;
  telephone: string | null;
  actif: number;
};

const emptyActe = { code: "", libelle: "", categorie: "Consultation", tarif: 0, duree_minutes: 30 };
const emptyUser = { full_name: "", email: "", password: "", role: "secretaire", specialite: "", telephone: "" };

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"actes" | "utilisateurs">("actes");

  return (
    <>
      <PageHeader title="Paramètres" />
      <div className="content">
        <div className="tabs">
          <button className={tab === "actes" ? "active" : ""} onClick={() => setTab("actes")}>
            Actes & tarifs
          </button>
          {user?.role === "admin" && (
            <button className={tab === "utilisateurs" ? "active" : ""} onClick={() => setTab("utilisateurs")}>
              Utilisateurs
            </button>
          )}
        </div>
        {tab === "actes" && <ActesTab />}
        {tab === "utilisateurs" && user?.role === "admin" && <UsersTab />}
      </div>
    </>
  );
}

function ActesTab() {
  const [actes, setActes] = useState<Acte[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Acte | null>(null);
  const [form, setForm] = useState(emptyActe);
  const [error, setError] = useState("");

  async function load() {
    setActes(await api.get<Acte[]>("/actes"));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyActe);
    setError("");
    setShowForm(true);
  }

  function openEdit(a: Acte) {
    setEditing(a);
    setForm({ code: a.code ?? "", libelle: a.libelle, categorie: a.categorie, tarif: a.tarif, duree_minutes: a.duree_minutes });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.put(`/actes/${editing.id}`, form);
      } else {
        await api.post("/actes", form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer cet acte ?")) return;
    await api.delete(`/actes/${id}`);
    load();
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nouvel acte
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Libellé</th>
            <th>Catégorie</th>
            <th>Tarif</th>
            <th>Durée</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {actes.map((a) => (
            <tr key={a.id}>
              <td>{a.code || "-"}</td>
              <td>{a.libelle}</td>
              <td>{a.categorie}</td>
              <td>{formatMAD(a.tarif)}</td>
              <td>{a.duree_minutes} min</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>
                  Modifier
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <Modal title={editing ? "Modifier l'acte" : "Nouvel acte"} onClose={() => setShowForm(false)} width={480}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                  <option value="Consultation">Consultation</option>
                  <option value="Acte technique">Acte technique</option>
                  <option value="Analyse">Analyse</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="form-field full">
                <label>Libellé *</label>
                <input required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Tarif (DH)</label>
                <input type="number" min={0} step="0.01" value={form.tarif} onChange={(e) => setForm({ ...form, tarif: Number(e.target.value) || 0 })} />
              </div>
              <div className="form-field">
                <label>Durée (minutes)</label>
                <input type="number" min={5} step="5" value={form.duree_minutes} onChange={(e) => setForm({ ...form, duree_minutes: Number(e.target.value) || 30 })} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyUser);
  const [error, setError] = useState("");

  async function load() {
    setUsers(await api.get<UserRow[]>("/auth/users"));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyUser);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/users", { ...form, specialite: form.specialite || undefined, telephone: form.telephone || undefined });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    }
  }

  async function toggleActif(u: UserRow) {
    await api.patch(`/auth/users/${u.id}`, { actif: u.actif ? 0 : 1 });
    load();
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nouvel utilisateur
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Spécialité</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td style={{ textTransform: "capitalize" }}>{u.role}</td>
              <td>{u.specialite || "-"}</td>
              <td>{u.actif ? "Actif" : "Désactivé"}</td>
              <td>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleActif(u)}>
                  {u.actif ? "Désactiver" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <Modal title="Nouvel utilisateur" onClose={() => setShowForm(false)} width={480}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field full">
                <label>Nom complet *</label>
                <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Mot de passe *</label>
                <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Rôle</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="secretaire">Secrétaire</option>
                  <option value="medecin">Médecin</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              {form.role === "medecin" && (
                <div className="form-field">
                  <label>Spécialité</label>
                  <select value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })}>
                    <option value="">Sélectionner…</option>
                    {SPECIALITES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>Téléphone</label>
                <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
