import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canMaintain, type UserProfile } from "../roles";

interface Reactivation {
  id: number;
  cif: string;
  account_no: string;
  current_status: string;
  reactivation_reason: string;
  document_ref: string;
  decision: string | null;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

const EMPTY: Partial<Reactivation> = { cif: "", account_no: "", current_status: "", reactivation_reason: "", document_ref: "" };

export function M05Reactivate({ user }: { user: UserProfile }) {
  const [results, setResults] = useState<Reactivation[]>([]);
  const [form, setForm] = useState<Partial<Reactivation>>(EMPTY);
  const [mode, setMode] = useState<"query" | "new" | "view">("query");
  const [activeTab, setActiveTab] = useState("main");
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const maintain = canMaintain(user.role);

  async function executeQuery() {
    setError(null);
    try {
      setResults(await api.get<Reactivation[]>("/m05/search"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  useEffect(() => {
    executeQuery();
  }, []);

  function selectRow(row: Reactivation) {
    setForm(row);
    setMode("view");
    setActiveTab("main");
    api.get<any[]>(`/m05/${row.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  function startNew() {
    setForm(EMPTY);
    setMode("new");
    setError(null);
    setInfo(null);
  }

  async function lookupAccount() {
    setError(null);
    setInfo(null);
    try {
      const accounts = await api.get<any[]>(`/lov/accounts?cif=${encodeURIComponent(form.cif ?? "")}`);
      const acc = accounts.find((a) => a.account_no === form.account_no);
      if (!acc) {
        setError("Compte introuvable pour ce Tiers/CIF.");
        return;
      }
      setForm({ ...form, current_status: acc.status });
      setInfo(acc.status === "DESHERENCE" ? "Compte réactivable." : "Ce compte n'est pas en statut DESHERENCE — réactivation impossible (RG-07).");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de consultation.");
    }
  }

  async function save() {
    setError(null);
    try {
      const row = await api.post<Reactivation>("/m05", { ...form, actorLogin: user.login, actorRole: user.role });
      setForm(row);
      setMode("view");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }

  async function remove() {
    if (!form.id) return;
    setError(null);
    try {
      await api.del(`/m05/${form.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setForm(EMPTY);
      setMode("query");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  const editable = mode === "new" && maintain;

  return (
    <EnterpriseShell
      functionId="BOA.DESH.REACTIVATE"
      screenTitle="M05 - Saisie réactivation manuelle"
      user={user.login}
      toolbar={[
        { key: "new", label: "New", onClick: startNew, disabled: !maintain },
        { key: "query", label: "Enter Query", onClick: () => setMode("query") },
        { key: "exec", label: "Execute Query", onClick: executeQuery },
        { key: "save", label: "Save", onClick: save, disabled: !editable, variant: "primary" },
        { key: "delete", label: "Delete", onClick: remove, disabled: !maintain || form.status !== "U" || !form.id, variant: "danger" },
        { key: "close", label: "Close", onClick: () => { setForm(EMPTY); setMode("query"); } },
      ]}
      tabs={[
        { key: "main", label: "Main" },
        { key: "audit", label: "Audit" },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      footer={{
        recordStatus: form.id ? (form.status === "A" ? "Authorized" : "Unauthorized") : undefined,
        statusVariant: form.status === "A" ? "AUTHORIZED" : "SUBMITTED",
        maker: form.maker ?? undefined,
        checker: form.checker ?? undefined,
        version: form.version,
        lastAction: form.last_action,
      }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      {info && <Callout variant="info">{info}</Callout>}

      {activeTab === "main" && (
        <>
          {mode !== "new" && (
            <>
              <div className="section-title">Demandes de réactivation</div>
              <table className="eb-grid">
                <thead>
                  <tr>
                    <th>Customer / CIF</th>
                    <th>Account</th>
                    <th>Reactivation Reason</th>
                    <th>Document Ref</th>
                    <th>Auth Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className={form.id === r.id ? "selected" : ""} onClick={() => selectRow(r)}>
                      <td>{r.cif}</td>
                      <td>{r.account_no}</td>
                      <td>{r.reactivation_reason}</td>
                      <td>{r.document_ref}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(mode === "new" || mode === "view") && (
            <div className="detail-panel">
              <FieldRow>
                <Field label="Customer / CIF" required readOnly={!editable}>
                  <input value={form.cif ?? ""} disabled={!editable} onChange={(e) => setForm({ ...form, cif: e.target.value })} />
                </Field>
                <Field label="Account" required readOnly={!editable}>
                  <div className="field-with-btn">
                    <input value={form.account_no ?? ""} disabled={!editable} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
                    {editable && <button onClick={lookupAccount}>Vérifier</button>}
                  </div>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Current Status" readOnly>
                  <input value={form.current_status ?? ""} disabled />
                </Field>
                <Field label="Document Ref (GED)" required readOnly={!editable}>
                  <input value={form.document_ref ?? ""} disabled={!editable} onChange={(e) => setForm({ ...form, document_ref: e.target.value })} />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Reactivation Reason" required readOnly={!editable}>
                  <textarea rows={2} value={form.reactivation_reason ?? ""} disabled={!editable} onChange={(e) => setForm({ ...form, reactivation_reason: e.target.value })} />
                </Field>
              </FieldRow>
              {form.decision && (
                <FieldRow>
                  <Field label="Décision M06" readOnly>
                    <input value={form.decision} disabled />
                  </Field>
                </FieldRow>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "audit" && (
        <>
          <div className="section-title">Journal d'audit (append-only)</div>
          {audit.length === 0 && <p className="hint">Sélectionner une demande pour afficher son historique.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  {a.action} — {a.result}
                </span>
                <span>{a.ts}</span>
              </div>
              <div>
                Acteur: {a.actor} ({a.role}) | correlationId: {a.correlation_id}
              </div>
              {a.motif && <div>Motif: {a.motif}</div>}
            </div>
          ))}
        </>
      )}
    </EnterpriseShell>
  );
}
