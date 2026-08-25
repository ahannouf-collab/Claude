import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface ContribRecord {
  id: number;
  event_code: string;
  effective_from: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "AUTHORIZED";
  contribution: string;
  event_active_status: string;
  maker: string | null;
  checker: string | null;
  last_action: string;
}

const CONTRIBUTIONS = ["NO_DEBIT_NO_CREDIT", "NO_DEBIT", "NO_CREDIT", "NONE"];

function ruleGrid(contribution: string) {
  const debit = contribution === "NO_DEBIT_NO_CREDIT" || contribution === "NO_DEBIT" ? "Y" : "N";
  const credit = contribution === "NO_DEBIT_NO_CREDIT" || contribution === "NO_CREDIT" ? "Y" : "N";
  return [
    { rule: "Debit Contribution", value: debit, controlledBy: "MCL" },
    { rule: "Credit Contribution", value: credit, controlledBy: "MCL" },
    { rule: "Priority", value: "Not used", controlledBy: "Matrix logic" },
  ];
}

export function M8MclContribution({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState("Main");
  const [record, setRecord] = useState<ContribRecord | null>(null);
  const [audit, setAudit] = useState<ContribRecord[]>([]);
  const [form, setForm] = useState({ event_code: "", effective_from: "", contribution: CONTRIBUTIONS[0], event_active_status: "Active" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isDraft = record?.status === "DRAFT";
  const isSubmitted = record?.status === "SUBMITTED";
  const isAuthorized = record?.status === "AUTHORIZED";
  const editable = !record || isDraft;

  function reset() {
    setRecord(null);
    setForm({ event_code: "", effective_from: "", contribution: CONTRIBUTIONS[0], event_active_status: "Active" });
    setError(null);
    setInfo(null);
    setAudit([]);
    setTab("Main");
  }

  function applyRecord(row: ContribRecord) {
    setRecord(row);
    setForm({ event_code: row.event_code, effective_from: row.effective_from, contribution: row.contribution, event_active_status: row.event_active_status });
  }

  async function loadAudit(eventCode: string, effectiveFrom: string) {
    try {
      setAudit(await api.get<ContribRecord[]>(`/m8/${encodeURIComponent(eventCode)}/${effectiveFrom}/audit`));
    } catch {
      /* best effort */
    }
  }

  async function handleQuery() {
    setError(null);
    setInfo(null);
    if (!form.event_code || !form.effective_from) {
      setError("Event Code et Effective From sont requis pour Query.");
      return;
    }
    try {
      const row = await api.get<ContribRecord>(`/m8/${encodeURIComponent(form.event_code)}/${form.effective_from}`);
      applyRecord(row);
      await loadAudit(row.event_code, row.effective_from);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Contribution introuvable.");
      setRecord(null);
    }
  }

  async function handleSave() {
    setError(null);
    setInfo(null);
    try {
      if (record) {
        const updated = await api.put<ContribRecord>(`/m8/${record.id}`, form);
        applyRecord(updated);
        setInfo("Brouillon enregistré.");
      } else {
        const created = await api.post<ContribRecord>(`/m8`, form);
        applyRecord(created);
        setInfo("Brouillon créé.");
        await loadAudit(created.event_code, created.effective_from);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function handleSubmit() {
    if (!record) return;
    try {
      const updated = await api.post<ContribRecord>(`/m8/${record.id}/submit`, { user: user.login });
      setRecord({ ...record, ...updated });
      setInfo("Record soumis pour autorisation.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Submit.");
    }
  }

  async function handleAuthorize() {
    if (!record) return;
    try {
      const updated = await api.post<ContribRecord>(`/m8/${record.id}/authorize`, { user: user.login });
      const full = await api.get<ContribRecord>(`/m8/${updated.event_code}/${updated.effective_from}`);
      applyRecord(full);
      setInfo("Version activée (Authorize).");
      await loadAudit(full.event_code, full.effective_from);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Authorize.");
    }
  }

  async function handleUnlock() {
    if (!record) return;
    try {
      const unlocked = await api.post<ContribRecord>(`/m8/${record.id}/unlock`);
      applyRecord(unlocked);
      setInfo("Nouvelle version en modification (brouillon).");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Unlock.");
    }
  }

  async function handleDelete() {
    if (!record) return;
    try {
      await api.del(`/m8/${record.id}`);
      setInfo("Brouillon supprimé.");
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Delete.");
    }
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "new", label: "New", onClick: reset, disabled: !canMaintain(user.role) },
    { key: "query", label: "Query", onClick: handleQuery },
    { key: "unlock", label: "Unlock", onClick: handleUnlock, disabled: !canMaintain(user.role) || !isAuthorized },
    { key: "save", label: "Save", onClick: handleSave, disabled: !canMaintain(user.role) || !editable, variant: "primary" },
    { key: "delete", label: "Delete", onClick: handleDelete, disabled: !canMaintain(user.role) || !isDraft, variant: "danger" },
    { key: "submit", label: "Submit", onClick: handleSubmit, disabled: !canMaintain(user.role) || !isDraft },
    {
      key: "authorize",
      label: "Authorize",
      onClick: handleAuthorize,
      disabled: !canAuthorize(user.role) || !isSubmitted || record?.maker === user.login,
    },
    { key: "print", label: "Print", onClick: () => window.print() },
    { key: "close", label: "Close", onClick: reset },
  ];

  return (
    <EnterpriseShell
      functionId="MCDMCLMX"
      screenTitle="M8 - Paramétrage - MCL Restriction Contribution"
      toolbar={toolbar}
      tabs={[
        { key: "Main", label: "Main" },
        { key: "Audit", label: "Audit" },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      user={user.login}
      footer={{
        recordStatus: record ? record.status : "New",
        statusVariant: record ? record.status : "DRAFT",
        maker: record?.maker ?? undefined,
        checker: record?.checker ?? undefined,
        version: record?.version ?? "-",
        lastAction: record?.last_action ?? "New",
      }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      {info && !error && <Callout variant="info">{info}</Callout>}

      {tab === "Main" && (
        <>
          <FieldRow>
            <Field label="Event Code" required readOnly={!!record}>
              <input
                value={form.event_code}
                disabled={!!record}
                onChange={(e) => setForm({ ...form, event_code: e.target.value.toUpperCase() })}
                placeholder="Ex: GEL"
              />
            </Field>
            <Field label="Contribution" required>
              <select value={form.contribution} disabled={!editable} onChange={(e) => setForm({ ...form, contribution: e.target.value })}>
                {CONTRIBUTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Effective From" required readOnly={!!record}>
              <input
                type="date"
                value={form.effective_from}
                disabled={!!record}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.event_active_status}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, event_active_status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>
          </FieldRow>

          <div className="section-title">Règles dérivées de la Contribution</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Value</th>
                <th>Controlled By</th>
              </tr>
            </thead>
            <tbody>
              {ruleGrid(form.contribution).map((r) => (
                <tr key={r.rule}>
                  <td>{r.rule}</td>
                  <td>{r.value}</td>
                  <td>{r.controlledBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "Audit" && (
        <>
          <div className="section-title">Historique des versions (append-only)</div>
          {audit.length === 0 && <p className="hint">Aucun historique — exécuter Query pour charger une contribution.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  v{a.version} — {a.status}
                </span>
                <span>{a.last_action}</span>
              </div>
              <div>Contribution: {a.contribution}</div>
              <div>
                Maker: {a.maker ?? "-"} | Checker: {a.checker ?? "-"}
              </div>
            </div>
          ))}
        </>
      )}

      <Callout>Contextual behavior: toolbar actions are enabled/disabled by record state, role, authorization status and business controls.</Callout>
    </EnterpriseShell>
  );
}
