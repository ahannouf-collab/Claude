import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface DecisionN2 {
  id: number;
  decision_n1_id: number;
  cif: string;
  account_no: string;
  book_balance: number;
  inactive_days: number;
  proposal: string;
  decision: string;
  motif: string | null;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
  n1History?: { decision: string; motif: string | null; maker: string | null; checker: string | null };
}

export function M04DecisionN2({ user }: { user: UserProfile }) {
  const [criteria, setCriteria] = useState({ cif: "", account: "", decision: "" });
  const [results, setResults] = useState<DecisionN2[]>([]);
  const [form, setForm] = useState<Partial<DecisionN2>>({});
  const [decisionInput, setDecisionInput] = useState("PENDING");
  const [motifInput, setMotifInput] = useState("");
  const [expectedVersion, setExpectedVersion] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState("main");
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const maintain = canMaintain(user.role);
  const authorizeAllowed = canAuthorize(user.role);

  async function executeQuery() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (criteria.cif) params.set("cif", criteria.cif);
      if (criteria.account) params.set("account", criteria.account);
      if (criteria.decision) params.set("decision", criteria.decision);
      setResults(await api.get<DecisionN2[]>(`/m04/search?${params.toString()}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  useEffect(() => {
    executeQuery();
  }, []);

  async function selectRow(row: DecisionN2) {
    const full = await api.get<DecisionN2>(`/m04/${row.id}`);
    setForm(full);
    setDecisionInput(full.decision);
    setMotifInput(full.motif ?? "");
    setExpectedVersion(full.version);
    setActiveTab("main");
    api.get<any[]>(`/m04/${row.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  async function save() {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.put<DecisionN2>(`/m04/${form.id}`, {
        decision: decisionInput,
        motif: motifInput || null,
        expectedVersion,
        actorLogin: user.login,
        actorRole: user.role,
      });
      setForm(row);
      setExpectedVersion(row.version);
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }

  async function authorize() {
    if (!form.id) return;
    setError(null);
    try {
      const row = await api.post<DecisionN2>(`/m04/${form.id}/authorize`, { actorLogin: user.login, actorRole: user.role });
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
      await api.del(`/m04/${form.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setForm({});
      executeQuery();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  const editable = maintain && form.id && form.status === "U";

  return (
    <EnterpriseShell
      functionId="BOA.DESH.N2.WORKLIST"
      screenTitle="M04 - Décision back-office N2"
      user={user.login}
      toolbar={[
        { key: "query", label: "Enter Query", onClick: () => setForm({}) },
        { key: "exec", label: "Execute Query", onClick: executeQuery },
        { key: "save", label: "Save", onClick: save, disabled: !editable, variant: "primary" },
        { key: "auth", label: "Authorize", onClick: authorize, disabled: !authorizeAllowed || form.status !== "U" || !form.id },
        { key: "delete", label: "Delete", onClick: remove, disabled: !maintain || form.status !== "U" || !form.id, variant: "danger" },
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
            <Field label="Decision">
              <select value={criteria.decision} onChange={(e) => setCriteria({ ...criteria, decision: e.target.value })}>
                <option value="">(tous)</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="HOLD">HOLD</option>
              </select>
            </Field>
            <button onClick={executeQuery}>Rechercher</button>
          </div>

          <table className="eb-grid">
            <thead>
              <tr>
                <th>Customer / CIF</th>
                <th>Account</th>
                <th>Book Balance</th>
                <th>Inactive Days</th>
                <th>Proposal</th>
                <th>Decision</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className={form.id === r.id ? "selected" : ""} onClick={() => selectRow(r)}>
                  <td>{r.cif}</td>
                  <td>{r.account_no}</td>
                  <td>{r.book_balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD</td>
                  <td>{r.inactive_days.toLocaleString("fr-FR")}</td>
                  <td>{r.proposal}</td>
                  <td>
                    <span className={`badge badge-${r.decision}`}>{r.decision}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} className="hint">
                    Aucun dossier — Execute Query pour charger la worklist.
                  </td>
                </tr>
              )}
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
                <Field label="Book Balance" readOnly>
                  <input value={`${form.book_balance?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD`} disabled />
                </Field>
                <Field label="Inactive Days" readOnly>
                  <input value={form.inactive_days?.toLocaleString("fr-FR")} disabled />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Proposal" readOnly>
                  <input value={form.proposal ?? ""} disabled />
                </Field>
                <Field label="Decision" required readOnly={!editable}>
                  <select value={decisionInput} disabled={!editable} onChange={(e) => setDecisionInput(e.target.value)}>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVE">APPROVE</option>
                    <option value="REJECT">REJECT</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Motif (obligatoire si Reject/Hold)" readOnly={!editable}>
                  <textarea rows={2} value={motifInput} disabled={!editable} onChange={(e) => setMotifInput(e.target.value)} />
                </Field>
              </FieldRow>
              {form.n1History && (
                <FieldRow>
                  <Field label="Décision N1 historisée (RG-07)" readOnly>
                    <input
                      value={`${form.n1History.decision}${form.n1History.motif ? " — " + form.n1History.motif : ""} (Maker: ${form.n1History.maker ?? "-"} / Checker: ${form.n1History.checker ?? "-"})`}
                      disabled
                    />
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
          {audit.length === 0 && <p className="hint">Sélectionner un dossier pour afficher son historique.</p>}
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
