import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface Parameter {
  id: number;
  parameter_code: string;
  dormancy_low_days: number;
  dormancy_high_days: number;
  balance_threshold: number;
  currency: string;
  fee_ttc: number;
  fee_ude: number;
  valid_from: string;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

const EMPTY: Partial<Parameter> = {
  parameter_code: "BOA.DESH.PARAM",
  dormancy_low_days: 2555,
  dormancy_high_days: 3650,
  balance_threshold: 500,
  currency: "MAD",
  fee_ttc: 165,
  fee_ude: 82.5,
  valid_from: new Date().toISOString().slice(0, 10),
};

export function M01Parameter({ user }: { user: UserProfile }) {
  const [mode, setMode] = useState<"query" | "view" | "new" | "edit">("query");
  const [results, setResults] = useState<Parameter[]>([]);
  const [form, setForm] = useState<Partial<Parameter>>(EMPTY);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("main");
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const maintain = canMaintain(user.role);
  const authorizeAllowed = canAuthorize(user.role);

  async function executeQuery() {
    setError(null);
    try {
      const rows = await api.get<Parameter[]>("/m01/search");
      setResults(rows);
      setMode("view");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  useEffect(() => {
    executeQuery();
  }, []);

  function selectRow(row: Parameter) {
    setForm(row);
    setSelectedVersion(row.version);
    setActiveTab("main");
    setMode("view");
    api.get<any[]>(`/m01/${row.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  function startNew() {
    setForm(EMPTY);
    setSelectedVersion(undefined);
    setMode("new");
    setError(null);
  }

  async function save() {
    setError(null);
    try {
      const row = await api.post<Parameter>("/m01", {
        ...form,
        expectedVersion: selectedVersion,
        actorLogin: user.login,
        actorRole: user.role,
      });
      setForm(row);
      setSelectedVersion(row.version);
      setMode("view");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }

  async function authorize() {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.post<Parameter>(`/m01/${form.id}/authorize`, { actorLogin: user.login, actorRole: user.role });
      setForm(row);
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'autorisation.");
    }
  }

  async function remove() {
    if (!form.id) return;
    setError(null);
    try {
      await api.del(`/m01/${form.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setForm(EMPTY);
      setMode("query");
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  const isEditable = mode === "new" || (mode === "view" && form.status === "U" && maintain);

  return (
    <EnterpriseShell
      functionId="BOA.DESH.PARAM"
      screenTitle="M01 - Paramétrage seuils, délais et workflow"
      user={user.login}
      toolbar={[
        { key: "new", label: "New", onClick: startNew, disabled: !maintain },
        { key: "query", label: "Enter Query", onClick: () => setMode("query"), disabled: !maintain && !authorizeAllowed },
        { key: "exec", label: "Execute Query", onClick: executeQuery },
        { key: "save", label: "Save", onClick: save, disabled: !maintain || !(mode === "new" || (mode === "view" && form.id)), variant: "primary" },
        {
          key: "auth",
          label: "Authorize",
          onClick: authorize,
          disabled: !authorizeAllowed || form.status !== "U" || !form.id,
        },
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
        recordStatus: form.status === "A" ? "Authorized" : form.id ? "Unauthorized" : undefined,
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
          {mode === "query" || results.length > 0 ? (
            <>
              <div className="section-title">Enregistrements (version courante)</div>
              <table className="eb-grid">
                <thead>
                  <tr>
                    <th>Parameter Code</th>
                    <th>Dormancy Low</th>
                    <th>Dormancy High</th>
                    <th>Threshold</th>
                    <th>Valid From</th>
                    <th>Version</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className={form.id === r.id ? "selected" : ""} onClick={() => selectRow(r)}>
                      <td>{r.parameter_code}</td>
                      <td>{r.dormancy_low_days}</td>
                      <td>{r.dormancy_high_days}</td>
                      <td>
                        {r.balance_threshold.toFixed(2)} {r.currency}
                      </td>
                      <td>{r.valid_from}</td>
                      <td>{r.version}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">Cliquer une ligne pour l'ouvrir en consultation/modification.</p>
            </>
          ) : null}

          {(mode === "new" || mode === "view" || mode === "edit") && (
            <div className="detail-panel">
              <FieldRow>
                <Field label="Parameter ID / Code" required readOnly={mode !== "new"}>
                  <input
                    value={form.parameter_code ?? ""}
                    disabled={mode !== "new"}
                    onChange={(e) => setForm({ ...form, parameter_code: e.target.value })}
                  />
                </Field>
                <Field label="Valid / Effective From" required readOnly={!isEditable}>
                  <input
                    type="date"
                    value={form.valid_from ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Dormancy Low Days" required readOnly={!isEditable}>
                  <input
                    type="number"
                    value={form.dormancy_low_days ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, dormancy_low_days: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Dormancy High Days" required readOnly={!isEditable}>
                  <input
                    type="number"
                    value={form.dormancy_high_days ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, dormancy_high_days: Number(e.target.value) })}
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Balance Threshold" required readOnly={!isEditable}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.balance_threshold ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, balance_threshold: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Currency" readOnly={!isEditable}>
                  <select value={form.currency ?? "MAD"} disabled={!isEditable} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Fee TTC" readOnly={!isEditable}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.fee_ttc ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, fee_ttc: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Fee UDE" readOnly={!isEditable}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.fee_ude ?? ""}
                    disabled={!isEditable}
                    onChange={(e) => setForm({ ...form, fee_ude: Number(e.target.value) })}
                  />
                </Field>
              </FieldRow>
            </div>
          )}
        </>
      )}

      {activeTab === "audit" && (
        <>
          <div className="section-title">Journal d'audit (append-only)</div>
          {audit.length === 0 && <p className="hint">Aucun événement audité pour cet enregistrement.</p>}
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
