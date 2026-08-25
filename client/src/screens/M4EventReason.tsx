import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface Translation {
  language: string;
  description: string;
  active: string;
}

interface ReasonRecord {
  id: number;
  event_code: string;
  reason_code: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "AUTHORIZED";
  description: string;
  maker: string | null;
  checker: string | null;
  last_action: string;
  translations: Translation[];
}

export function M4EventReason({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState("Main");
  const [record, setRecord] = useState<ReasonRecord | null>(null);
  const [audit, setAudit] = useState<ReasonRecord[]>([]);
  const [form, setForm] = useState({ event_code: "", reason_code: "", description: "" });
  const [translations, setTranslations] = useState<Translation[]>([
    { language: "FR", description: "", active: "Y" },
    { language: "EN", description: "", active: "Y" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isDraft = record?.status === "DRAFT";
  const isSubmitted = record?.status === "SUBMITTED";
  const isAuthorized = record?.status === "AUTHORIZED";
  const editable = !record || isDraft;

  function reset() {
    setRecord(null);
    setForm({ event_code: "", reason_code: "", description: "" });
    setTranslations([
      { language: "FR", description: "", active: "Y" },
      { language: "EN", description: "", active: "Y" },
    ]);
    setError(null);
    setInfo(null);
    setAudit([]);
    setTab("Main");
  }

  async function loadAudit(eventCode: string, reasonCode: string) {
    try {
      setAudit(await api.get<ReasonRecord[]>(`/m4/${encodeURIComponent(eventCode)}/${encodeURIComponent(reasonCode)}/audit`));
    } catch {
      /* best effort */
    }
  }

  function applyRecord(row: ReasonRecord) {
    setRecord(row);
    setForm({ event_code: row.event_code, reason_code: row.reason_code, description: row.description });
    setTranslations(row.translations.length ? row.translations : translations);
  }

  async function handleQuery() {
    setError(null);
    setInfo(null);
    if (!form.event_code || !form.reason_code) {
      setError("Event Code et Reason Code sont requis pour Query.");
      return;
    }
    try {
      const row = await api.get<ReasonRecord>(`/m4/${encodeURIComponent(form.event_code)}/${encodeURIComponent(form.reason_code)}`);
      applyRecord(row);
      await loadAudit(row.event_code, row.reason_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Motif introuvable.");
      setRecord(null);
    }
  }

  async function handleSave() {
    setError(null);
    setInfo(null);
    const payload = { ...form, translations };
    try {
      if (record) {
        const updated = await api.put<ReasonRecord>(`/m4/${record.id}`, payload);
        applyRecord(updated);
        setInfo("Brouillon enregistré.");
      } else {
        const created = await api.post<ReasonRecord>(`/m4`, payload);
        applyRecord(created);
        setInfo("Brouillon créé.");
        await loadAudit(created.event_code, created.reason_code);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function handleSubmit() {
    if (!record) return;
    try {
      const updated = await api.post<ReasonRecord>(`/m4/${record.id}/submit`, { user: user.login });
      setRecord({ ...record, ...updated });
      setInfo("Record soumis pour autorisation.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Submit.");
    }
  }

  async function handleAuthorize() {
    if (!record) return;
    try {
      const updated = await api.post<ReasonRecord>(`/m4/${record.id}/authorize`, { user: user.login });
      const full = await api.get<ReasonRecord>(`/m4/${updated.event_code}/${updated.reason_code}`);
      applyRecord(full);
      setInfo("Version autorisée.");
      await loadAudit(full.event_code, full.reason_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Authorize.");
    }
  }

  async function handleUnlock() {
    if (!record) return;
    try {
      const unlocked = await api.post<ReasonRecord>(`/m4/${record.id}/unlock`);
      applyRecord(unlocked);
      setInfo("Nouvelle version en modification (brouillon).");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Unlock.");
    }
  }

  async function handleDelete() {
    if (!record) return;
    try {
      await api.del(`/m4/${record.id}`);
      setInfo("Brouillon supprimé.");
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Delete.");
    }
  }

  function updateTranslation(lang: string, description: string) {
    setTranslations((ts) => ts.map((t) => (t.language === lang ? { ...t, description } : t)));
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
      functionId="MCDCEVRS"
      screenTitle="M4 - Paramétrage - Event Reason Maintenance"
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
            <Field label="Reason Code" required readOnly={!!record}>
              <input
                value={form.reason_code}
                disabled={!!record}
                onChange={(e) => setForm({ ...form, reason_code: e.target.value.toUpperCase() })}
                placeholder="Ex: GEL-001"
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Description" required>
              <input
                value={form.description}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Avis initial"
              />
            </Field>
            <Field label="Authorization" readOnly>
              <input value={record ? record.status : "Unauthorized"} disabled />
            </Field>
          </FieldRow>

          <div className="section-title">Traductions</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Language</th>
                <th>Description</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {translations.map((t) => (
                <tr key={t.language}>
                  <td>{t.language}</td>
                  <td>
                    <input
                      style={{ width: "100%" }}
                      value={t.description}
                      disabled={!editable}
                      onChange={(e) => updateTranslation(t.language, e.target.value)}
                    />
                  </td>
                  <td>{t.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "Audit" && (
        <>
          <div className="section-title">Historique des versions (append-only)</div>
          {audit.length === 0 && <p className="hint">Aucun historique — exécuter Query pour charger un motif.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  v{a.version} — {a.status}
                </span>
                <span>{a.last_action}</span>
              </div>
              <div>Description: {a.description}</div>
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
