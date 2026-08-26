import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canAuthorize, type UserProfile } from "../roles";

interface Reactivation {
  id: number;
  cif: string;
  account_no: string;
  current_status: string;
  reactivation_reason: string;
  document_ref: string;
  decision: string | null;
  reject_motif: string | null;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

export function M06ReactivateAuth({ user }: { user: UserProfile }) {
  const [criteria, setCriteria] = useState({ cif: "", account: "", status: "U" });
  const [results, setResults] = useState<Reactivation[]>([]);
  const [form, setForm] = useState<Partial<Reactivation>>({});
  const [rejectMotif, setRejectMotif] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const authorizeAllowed = canAuthorize(user.role);

  async function executeQuery() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (criteria.cif) params.set("cif", criteria.cif);
      if (criteria.account) params.set("account", criteria.account);
      if (criteria.status) params.set("status", criteria.status);
      setResults(await api.get<Reactivation[]>(`/m06/search?${params.toString()}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  useEffect(() => {
    executeQuery();
  }, []);

  function selectRow(row: Reactivation) {
    setForm(row);
    setRejectMotif("");
    setActiveTab("main");
    api.get<any[]>(`/m06/${row.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.post<Reactivation>(`/m06/${form.id}/authorize`, {
        decision,
        motif: decision === "REJECT" ? rejectMotif : undefined,
        actorLogin: user.login,
        actorRole: user.role,
      });
      setForm(row);
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'autorisation.");
    }
  }

  const canDecide = authorizeAllowed && form.id && form.status === "U";

  return (
    <EnterpriseShell
      functionId="BOA.DESH.REACT.AUTH"
      screenTitle="M06 - Autorisation réactivation"
      user={user.login}
      toolbar={[
        { key: "query", label: "Enter Query", onClick: () => setForm({}) },
        { key: "exec", label: "Execute Query", onClick: executeQuery },
        { key: "auth", label: "Authorize (Approve)", onClick: () => decide("APPROVE"), disabled: !canDecide, variant: "primary" },
        { key: "reject", label: "Reject", onClick: () => decide("REJECT"), disabled: !canDecide || !rejectMotif, variant: "danger" },
        { key: "close", label: "Close", onClick: () => setForm({}) },
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

      {activeTab === "main" && (
        <>
          <div className="search-bar">
            <Field label="Customer / CIF">
              <input value={criteria.cif} onChange={(e) => setCriteria({ ...criteria, cif: e.target.value })} />
            </Field>
            <Field label="Account">
              <input value={criteria.account} onChange={(e) => setCriteria({ ...criteria, account: e.target.value })} />
            </Field>
            <Field label="Auth Status">
              <select value={criteria.status} onChange={(e) => setCriteria({ ...criteria, status: e.target.value })}>
                <option value="">(tous)</option>
                <option value="U">U — en attente</option>
                <option value="A">A — traitées</option>
              </select>
            </Field>
            <button onClick={executeQuery}>Rechercher</button>
          </div>

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
                    {r.decision && <span className={`badge badge-${r.decision}`} style={{ marginLeft: 4 }}>{r.decision}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {form.id && (
            <div className="detail-panel">
              <FieldRow>
                <Field label="Customer / CIF" readOnly>
                  <input value={form.cif ?? ""} disabled />
                </Field>
                <Field label="Account" readOnly>
                  <input value={form.account_no ?? ""} disabled />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Current Status" readOnly>
                  <input value={form.current_status ?? ""} disabled />
                </Field>
                <Field label="Document Ref" readOnly>
                  <input value={form.document_ref ?? ""} disabled />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Reactivation Reason" readOnly>
                  <textarea rows={2} value={form.reactivation_reason ?? ""} disabled />
                </Field>
              </FieldRow>
              {canDecide && (
                <FieldRow>
                  <Field label="Motif de rejet (si Reject)">
                    <textarea rows={2} value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} />
                  </Field>
                </FieldRow>
              )}
              {form.status === "A" && (
                <FieldRow>
                  <Field label="Décision" readOnly>
                    <input value={`${form.decision}${form.reject_motif ? " — " + form.reject_motif : ""}`} disabled />
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
