import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface ReasonRow {
  reason_code: string;
  description: string;
  active: string;
  effective_from: string;
}

interface EventRecord {
  id: number;
  event_code: string;
  version: number;
  is_current: number;
  status: "DRAFT" | "SUBMITTED" | "AUTHORIZED";
  description: string;
  domain: string;
  event_status: string;
  maker: string | null;
  checker: string | null;
  last_action: string;
  reasons?: ReasonRow[];
}

const DOMAINS = ["REGULATORY", "LEGAL", "COMPLIANCE", "OPERATIONAL"];

export function M1CodeEvent({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState("Main");
  const [mode, setMode] = useState<"new" | "loaded">("new");
  const [searchCode, setSearchCode] = useState("");
  const [record, setRecord] = useState<EventRecord | null>(null);
  const [audit, setAudit] = useState<EventRecord[]>([]);
  const [form, setForm] = useState({ event_code: "", description: "", domain: DOMAINS[0], event_status: "Active" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isDraft = record?.status === "DRAFT";
  const isSubmitted = record?.status === "SUBMITTED";
  const isAuthorized = record?.status === "AUTHORIZED";
  const editable = mode === "new" || isDraft;

  function reset() {
    setMode("new");
    setRecord(null);
    setForm({ event_code: "", description: "", domain: DOMAINS[0], event_status: "Active" });
    setError(null);
    setInfo(null);
    setAudit([]);
    setTab("Main");
  }

  async function loadAudit(eventCode: string) {
    try {
      const rows = await api.get<EventRecord[]>(`/m1/${encodeURIComponent(eventCode)}/audit`);
      setAudit(rows);
    } catch {
      /* audit is best-effort */
    }
  }

  async function handleQuery() {
    setError(null);
    setInfo(null);
    const code = (mode === "new" ? form.event_code : searchCode) || searchCode || form.event_code;
    if (!code) {
      setError("Saisir un Event Code pour Query.");
      return;
    }
    try {
      const row = await api.get<EventRecord>(`/m1/${encodeURIComponent(code)}`);
      setRecord(row);
      setForm({ event_code: row.event_code, description: row.description, domain: row.domain, event_status: row.event_status });
      setMode("loaded");
      await loadAudit(row.event_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Event Code introuvable.");
      setRecord(null);
      setMode("new");
    }
  }

  async function handleSave() {
    setError(null);
    setInfo(null);
    try {
      if (record) {
        const updated = await api.put<EventRecord>(`/m1/${record.id}`, form);
        setRecord(updated);
        setInfo("Brouillon enregistré.");
      } else {
        const created = await api.post<EventRecord>(`/m1`, form);
        setRecord(created);
        setMode("loaded");
        setInfo("Brouillon créé.");
        await loadAudit(created.event_code);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function handleSubmit() {
    if (!record) return;
    setError(null);
    try {
      const updated = await api.post<EventRecord>(`/m1/${record.id}/submit`, { user: user.login });
      setRecord({ ...record, ...updated });
      setInfo("Record soumis pour autorisation.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Submit.");
    }
  }

  async function handleAuthorize() {
    if (!record) return;
    setError(null);
    try {
      const updated = await api.post<EventRecord>(`/m1/${record.id}/authorize`, { user: user.login });
      const full = await api.get<EventRecord>(`/m1/${updated.event_code}`);
      setRecord(full);
      setInfo("Version autorisée.");
      await loadAudit(full.event_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Authorize.");
    }
  }

  async function handleUnlock() {
    if (!record) return;
    setError(null);
    try {
      const unlocked = await api.post<EventRecord>(`/m1/${record.id}/unlock`);
      setRecord(unlocked);
      setForm({ event_code: unlocked.event_code, description: unlocked.description, domain: unlocked.domain, event_status: unlocked.event_status });
      setInfo("Nouvelle version en modification (brouillon).");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Unlock.");
    }
  }

  async function handleDelete() {
    if (!record) return;
    setError(null);
    try {
      await api.del(`/m1/${record.id}`);
      setInfo("Brouillon supprimé.");
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Delete.");
    }
  }

  async function handleCopy() {
    if (!record) return;
    const newCode = window.prompt("Nouveau Event Code pour la copie :");
    if (!newCode) return;
    setError(null);
    try {
      const created = await api.post<EventRecord>(`/m1/${record.id}/copy`, { event_code: newCode });
      setRecord(created);
      setForm({ event_code: created.event_code, description: created.description, domain: created.domain, event_status: created.event_status });
      setMode("loaded");
      setInfo("Nouveau code créé par copie.");
      await loadAudit(created.event_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Copy.");
    }
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "new", label: "New", onClick: reset, disabled: !canMaintain(user.role) },
    { key: "query", label: "Query", onClick: handleQuery },
    { key: "unlock", label: "Unlock", onClick: handleUnlock, disabled: !canMaintain(user.role) || !isAuthorized },
    { key: "save", label: "Save", onClick: handleSave, disabled: !canMaintain(user.role) || !editable, variant: "primary" },
    { key: "delete", label: "Delete", onClick: handleDelete, disabled: !canMaintain(user.role) || !isDraft, variant: "danger" },
    { key: "submit", label: "Submit", onClick: handleSubmit, disabled: !canMaintain(user.role) || !isDraft || !record },
    {
      key: "authorize",
      label: "Authorize",
      onClick: handleAuthorize,
      disabled: !canAuthorize(user.role) || !isSubmitted || record?.maker === user.login,
      title: record?.maker === user.login ? "Le Checker doit être distinct du Maker" : undefined,
    },
    { key: "copy", label: "Copy", onClick: handleCopy, disabled: !canMaintain(user.role) || !record },
    { key: "print", label: "Print", onClick: () => window.print() },
    { key: "close", label: "Close", onClick: reset },
  ];

  return (
    <EnterpriseShell
      functionId="MCDCEVNT"
      screenTitle="M1 - Paramétrage - Code Event Maintenance"
      toolbar={toolbar}
      tabs={[
        { key: "Main", label: "Main" },
        { key: "Details", label: "Details" },
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
            <Field label="Status">
              <select
                value={form.event_status}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, event_status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Description" required>
              <input
                value={form.description}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Avis de gel"
              />
            </Field>
            <Field label="Domain" required>
              <select value={form.domain} disabled={!editable} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                {DOMAINS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </FieldRow>

          <div className="section-title">Reason Codes rattachés (lecture seule - maintenus via M4)</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Reason Code</th>
                <th>Reason Description</th>
                <th>Active</th>
                <th>Effective From</th>
              </tr>
            </thead>
            <tbody>
              {(record?.reasons ?? []).map((r) => (
                <tr key={r.reason_code}>
                  <td>{r.reason_code}</td>
                  <td>{r.description}</td>
                  <td>{r.active}</td>
                  <td>{r.effective_from}</td>
                </tr>
              ))}
              {(!record || (record.reasons ?? []).length === 0) && (
                <tr>
                  <td colSpan={4} style={{ color: "#5b6b7a", textAlign: "center" }}>
                    Aucun motif autorisé pour cet événement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {tab === "Details" && (
        <FieldRow>
          <Field label="Version" readOnly>
            <input value={record?.version ?? "-"} disabled />
          </Field>
          <Field label="Record Status" readOnly>
            <input value={record?.status ?? "New"} disabled />
          </Field>
        </FieldRow>
      )}

      {tab === "Audit" && (
        <>
          <div className="section-title">Historique des versions (append-only)</div>
          {audit.length === 0 && <p className="hint">Aucun historique — exécuter Query pour charger un Event Code.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  v{a.version} — {a.status}
                </span>
                <span>{a.last_action}</span>
              </div>
              <div>
                Description: {a.description} | Domain: {a.domain} | Status événement: {a.event_status}
              </div>
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
