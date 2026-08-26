import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface Exception {
  id: number;
  exception_id: string;
  cif: string;
  account_no: string;
  exception_type: string;
  owner: string;
  cycle_status: string;
  comment: string | null;
  corrective_action: string | null;
  resolved_ts: string | null;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

const EMPTY: Partial<Exception> = { exception_id: "", cif: "", account_no: "", exception_type: "", owner: "CBS.SUPPORT" };

export function M08Reconciliation({ user }: { user: UserProfile }) {
  const [criteria, setCriteria] = useState({ status: "", cif: "", account: "" });
  const [results, setResults] = useState<Exception[]>([]);
  const [form, setForm] = useState<Partial<Exception>>(EMPTY);
  const [mode, setMode] = useState<"query" | "new" | "view">("query");
  const [activeTab, setActiveTab] = useState("main");
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const maintain = canMaintain(user.role);
  const authorizeAllowed = canAuthorize(user.role);

  async function executeQuery() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (criteria.status) params.set("status", criteria.status);
      if (criteria.cif) params.set("cif", criteria.cif);
      if (criteria.account) params.set("account", criteria.account);
      setResults(await api.get<Exception[]>(`/m08/search?${params.toString()}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  useEffect(() => {
    executeQuery();
  }, []);

  function selectRow(row: Exception) {
    setForm(row);
    setMode("view");
    setActiveTab("main");
    api.get<any[]>(`/m08/${row.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  function startNew() {
    setForm(EMPTY);
    setMode("new");
    setError(null);
  }

  async function create() {
    setError(null);
    try {
      const row = await api.post<Exception>("/m08", { ...form, actorLogin: user.login, actorRole: user.role });
      setForm(row);
      setMode("view");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de création.");
    }
  }

  async function saveInvestigation() {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.put<Exception>(`/m08/${form.id}`, {
        comment: form.comment,
        corrective_action: form.corrective_action,
        owner: form.owner,
        expectedVersion: form.version,
        actorLogin: user.login,
        actorRole: user.role,
      });
      setForm(row);
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }

  async function resolve() {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.post<Exception>(`/m08/${form.id}/authorize`, { actorLogin: user.login, actorRole: user.role });
      setForm(row);
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de résolution.");
    }
  }

  async function remove() {
    if (!form.id) return;
    setError(null);
    try {
      await api.del(`/m08/${form.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setForm(EMPTY);
      setMode("query");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  const investigable = maintain && form.id && form.status === "U";

  return (
    <EnterpriseShell
      functionId="BOA.DESH.RECON.EXC"
      screenTitle="M08 - Anomalies et réconciliation"
      user={user.login}
      toolbar={[
        { key: "new", label: "New", onClick: startNew, disabled: !maintain },
        { key: "query", label: "Enter Query", onClick: () => setMode("query") },
        { key: "exec", label: "Execute Query", onClick: executeQuery },
        {
          key: "save",
          label: "Save",
          onClick: mode === "new" ? create : saveInvestigation,
          disabled: mode === "new" ? !maintain : !investigable,
          variant: "primary",
        },
        { key: "auth", label: "Authorize (Resolve)", onClick: resolve, disabled: !authorizeAllowed || form.status !== "U" || !form.id },
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

      {activeTab === "main" && (
        <>
          {mode !== "new" && (
            <>
              <div className="search-bar">
                <Field label="Status">
                  <select value={criteria.status} onChange={(e) => setCriteria({ ...criteria, status: e.target.value })}>
                    <option value="">(tous)</option>
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </Field>
                <Field label="Customer / CIF">
                  <input value={criteria.cif} onChange={(e) => setCriteria({ ...criteria, cif: e.target.value })} />
                </Field>
                <Field label="Account">
                  <input value={criteria.account} onChange={(e) => setCriteria({ ...criteria, account: e.target.value })} />
                </Field>
                <button onClick={executeQuery}>Rechercher</button>
              </div>

              <table className="eb-grid">
                <thead>
                  <tr>
                    <th>Exception ID</th>
                    <th>Customer / CIF</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className={form.id === r.id ? "selected" : ""} onClick={() => selectRow(r)}>
                      <td>{r.exception_id}</td>
                      <td>{r.cif}</td>
                      <td>{r.account_no}</td>
                      <td>{r.exception_type}</td>
                      <td>{r.owner}</td>
                      <td>
                        <span className={`badge badge-${r.cycle_status}`}>{r.cycle_status}</span>
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
                <Field label="Exception ID" required readOnly={mode !== "new"}>
                  <input value={form.exception_id ?? ""} disabled={mode !== "new"} onChange={(e) => setForm({ ...form, exception_id: e.target.value })} />
                </Field>
                <Field label="Owner" required readOnly={mode !== "new" && !investigable}>
                  <input value={form.owner ?? ""} disabled={mode !== "new" && !investigable} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Customer / CIF" required readOnly={mode !== "new"}>
                  <input value={form.cif ?? ""} disabled={mode !== "new"} onChange={(e) => setForm({ ...form, cif: e.target.value })} />
                </Field>
                <Field label="Account" required readOnly={mode !== "new"}>
                  <input value={form.account_no ?? ""} disabled={mode !== "new"} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Exception Type" required readOnly={mode !== "new"}>
                  <input value={form.exception_type ?? ""} disabled={mode !== "new"} onChange={(e) => setForm({ ...form, exception_type: e.target.value })} />
                </Field>
                <Field label="Status (cycle)" readOnly>
                  <input value={form.cycle_status ?? "OPEN"} disabled />
                </Field>
              </FieldRow>
              {mode === "view" && (
                <>
                  <FieldRow>
                    <Field label="Comment" readOnly={!investigable}>
                      <textarea rows={2} value={form.comment ?? ""} disabled={!investigable} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                    </Field>
                  </FieldRow>
                  <FieldRow>
                    <Field label="Corrective Action" readOnly={!investigable}>
                      <textarea rows={2} value={form.corrective_action ?? ""} disabled={!investigable} onChange={(e) => setForm({ ...form, corrective_action: e.target.value })} />
                    </Field>
                  </FieldRow>
                  {form.resolved_ts && (
                    <FieldRow>
                      <Field label="Resolved At" readOnly>
                        <input value={form.resolved_ts} disabled />
                      </Field>
                    </FieldRow>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "audit" && (
        <>
          <div className="section-title">Journal d'audit (append-only)</div>
          {audit.length === 0 && <p className="hint">Sélectionner une exception pour afficher son historique.</p>}
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
