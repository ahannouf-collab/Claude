import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api, ApiError } from "../api";
import { MODES_PAIEMENT, STATUTS_FACTURE, formatDate, formatMAD } from "../constants";

type Invoice = {
  id: number;
  numero: string;
  date: string;
  patient_nom: string;
  patient_prenom: string;
  montant_total: number;
  montant_paye: number;
  statut: string;
  mode_paiement: string;
};

type Patient = { id: number; nom: string; prenom: string; telephone: string };
type Acte = { id: number; libelle: string; tarif: number };

type Item = { acte_id: number | null; libelle: string; quantite: number; prix_unitaire: number };

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statutFilter, setStatutFilter] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [montantPaye, setMontantPaye] = useState("0");
  const [items, setItems] = useState<Item[]>([{ acte_id: null, libelle: "", quantite: 1, prix_unitaire: 0 }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("0");

  async function load() {
    const q = statutFilter ? `?statut=${statutFilter}` : "";
    setInvoices(await api.get<Invoice[]>(`/invoices${q}`));
  }

  useEffect(() => {
    load();
  }, [statutFilter]);

  useEffect(() => {
    api.get<Acte[]>("/actes").then(setActes);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<Patient[]>(`/patients?q=${encodeURIComponent(patientSearch)}`).then(setPatients);
    }, 200);
    return () => clearTimeout(t);
  }, [patientSearch]);

  function openForm() {
    setPatientId("");
    setPatientSearch("");
    setModePaiement("especes");
    setMontantPaye("0");
    setItems([{ acte_id: null, libelle: "", quantite: 1, prix_unitaire: 0 }]);
    setError("");
    setShowForm(true);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function selectActeForItem(index: number, acteId: string) {
    const acte = actes.find((a) => a.id === Number(acteId));
    updateItem(index, {
      acte_id: acte ? acte.id : null,
      libelle: acte ? acte.libelle : "",
      prix_unitaire: acte ? acte.tarif : 0,
    });
  }

  const total = items.reduce((sum, it) => sum + it.quantite * it.prix_unitaire, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError("Veuillez sélectionner un patient");
      return;
    }
    const validItems = items.filter((it) => it.libelle.trim());
    if (validItems.length === 0) {
      setError("Ajoutez au moins une ligne de facturation");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.post("/invoices", {
        patient_id: Number(patientId),
        mode_paiement: modePaiement,
        montant_paye: Number(montantPaye) || 0,
        items: validItems,
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInvoice) return;
    await api.patch(`/invoices/${payingInvoice.id}/paiement`, { montant_paye: Number(paymentAmount) || 0 });
    setPayingInvoice(null);
    load();
  }

  return (
    <>
      <PageHeader
        title="Facturation"
        actions={
          <button className="btn btn-primary" onClick={openForm}>
            + Nouvelle facture
          </button>
        }
      />
      <div className="content">
        <div className="toolbar">
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS_FACTURE).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {invoices.length === 0 ? (
            <div className="empty-state">Aucune facture trouvée.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Total</th>
                  <th>Payé</th>
                  <th>Mode</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.numero}</td>
                    <td>{formatDate(inv.date)}</td>
                    <td>
                      {inv.patient_prenom} {inv.patient_nom.toUpperCase()}
                    </td>
                    <td>{formatMAD(inv.montant_total)}</td>
                    <td>{formatMAD(inv.montant_paye)}</td>
                    <td>{MODES_PAIEMENT.find((m) => m.value === inv.mode_paiement)?.label ?? inv.mode_paiement}</td>
                    <td>
                      <span className="badge" style={{ background: STATUTS_FACTURE[inv.statut]?.color }}>
                        {STATUTS_FACTURE[inv.statut]?.label ?? inv.statut}
                      </span>
                    </td>
                    <td>
                      {inv.statut !== "payee" && inv.statut !== "annulee" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setPayingInvoice(inv);
                            setPaymentAmount(String(inv.montant_total));
                          }}
                        >
                          Encaisser
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Nouvelle facture" onClose={() => setShowForm(false)} width={720}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-field full" style={{ marginBottom: 14 }}>
              <label>Patient *</label>
              <input placeholder="Rechercher un patient…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
              <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ marginTop: 6 }}>
                <option value="">Sélectionner un patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.prenom} {p.nom.toUpperCase()} — {p.telephone}
                  </option>
                ))}
              </select>
            </div>

            <div className="section-title">Prestations</div>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select
                  value={item.acte_id ?? ""}
                  onChange={(e) => selectActeForItem(idx, e.target.value)}
                  style={{ flex: 2 }}
                >
                  <option value="">Acte personnalisé…</option>
                  {actes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.libelle}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Libellé"
                  value={item.libelle}
                  onChange={(e) => updateItem(idx, { libelle: e.target.value })}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantite}
                  onChange={(e) => updateItem(idx, { quantite: Number(e.target.value) || 1 })}
                  style={{ width: 60 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.prix_unitaire}
                  onChange={(e) => updateItem(idx, { prix_unitaire: Number(e.target.value) || 0 })}
                  style={{ width: 100 }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setItems((list) => list.filter((_, i) => i !== idx))}
                  disabled={items.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setItems((list) => [...list, { acte_id: null, libelle: "", quantite: 1, prix_unitaire: 0 }])}
            >
              + Ajouter une ligne
            </button>

            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="form-field">
                <label>Mode de paiement</label>
                <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                  {MODES_PAIEMENT.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Montant payé (DH)</label>
                <input type="number" min={0} step="0.01" value={montantPaye} onChange={(e) => setMontantPaye(e.target.value)} />
              </div>
            </div>

            <div style={{ textAlign: "right", fontSize: 18, fontWeight: 700, marginTop: 12 }}>
              Total : {formatMAD(total)}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Créer la facture"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payingInvoice && (
        <Modal title={`Encaisser ${payingInvoice.numero}`} onClose={() => setPayingInvoice(null)} width={420}>
          <form onSubmit={submitPayment}>
            <div className="form-field">
              <label>Montant payé (DH) — total {formatMAD(payingInvoice.montant_total)}</label>
              <input type="number" min={0} step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPayingInvoice(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Confirmer le paiement
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
