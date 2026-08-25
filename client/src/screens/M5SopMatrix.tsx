import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface MatrixRow {
  event: string;
  impact: string;
  severity: number;
  message: string;
  override: string;
  active: string;
}

interface MatrixRecord {
  id: number;
  sop: string;
  effective_from: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "AUTHORIZED";
  matrix_status: string;
  maker: string | null;
  checker: string | null;
  last_action: string;
  rows: MatrixRow[];
}

const IMPACTS = ["BLOCK_ALL", "BLOCK_DEBIT", "ALERT", "ALLOW"];
const emptyRow = (): MatrixRow => ({ event: "", impact: "BLOCK_ALL", severity: 0, message: "", override: "N", active: "Y" });

export function M5SopMatrix({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState("Main");
  const [record, setRecord] = useState<MatrixRecord | null>(null);
  const [audit, setAudit] = useState<MatrixRecord[]>([]);
  const [form, setForm] = useState({ sop: "", effective_from: "" });
  const [rows, setRows] = useState<MatrixRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isDraft = record?.status === "DRAFT";
  const isSubmitted = record?.status === "SUBMITTED";
  const isAuthorized = record?.status === "AUTHORIZED";
  const editable = !record || isDraft;

  function reset() {
    setRecord(null);
    setForm({ sop: "", effective_from: "" });
    setRows([emptyRow()]);
    setError(null);
    setInfo(null);
    setAudit([]);
    setTab("Main");
  }

  function applyRecord(row: MatrixRecord) {
    setRecord(row);
    setForm({ sop: row.sop, effective_from: row.effective_from });
    setRows(row.rows.length ? row.rows : [emptyRow()]);
  }

  async function loadAudit(sop: string, effectiveFrom: string) {
    try {
      setAudit(await api.get<MatrixRecord[]>(`/m5/${encodeURIComponent(sop)}/${effectiveFrom}/audit`));
    } catch {
      /* best effort */
    }
  }

  async function handleQuery() {
    setError(null);
    setInfo(null);
    if (!form.sop || !form.effective_from) {
      setError("SOP et Effective From sont requis pour Query.");
      return;
    }
    try {
      const row = await api.get<MatrixRecord>(`/m5/${encodeURIComponent(form.sop)}/${form.effective_from}`);
      applyRecord(row);
      await loadAudit(row.sop, row.effective_from);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Matrice introuvable.");
      setRecord(null);
    }
  }

  async function handleSave() {
    setError(null);
    setInfo(null);
    const payload = { ...form, rows };
    try {
      if (record) {
        const updated = await api.put<MatrixRecord>(`/m5/${record.id}`, payload);
        applyRecord(updated);
        setInfo("Brouillon enregistré.");
      } else {
        const created = await api.post<MatrixRecord>(`/m5`, payload);
        applyRecord(created);
        setInfo("Brouillon créé.");
        await loadAudit(created.sop, created.effective_from);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function handleSubmit() {
    if (!record) return;
    try {
      const updated = await api.post<MatrixRecord>(`/m5/${record.id}/submit`, { user: user.login });
      setRecord({ ...record, ...updated });
      setInfo("Record soumis pour autorisation.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Submit.");
    }
  }

  async function handleAuthorize() {
    if (!record) return;
    try {
      const updated = await api.post<MatrixRecord>(`/m5/${record.id}/authorize`, { user: user.login });
      const full = await api.get<MatrixRecord>(`/m5/${updated.sop}/${updated.effective_from}`);
      applyRecord(full);
      setInfo("Matrice publiée (Authorize).");
      await loadAudit(full.sop, full.effective_from);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Authorize.");
    }
  }

  async function handleUnlock() {
    if (!record) return;
    try {
      const unlocked = await api.post<MatrixRecord>(`/m5/${record.id}/unlock`);
      applyRecord(unlocked);
      setInfo("Nouvelle version en modification (brouillon).");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de l'Unlock.");
    }
  }

  async function handleDelete() {
    if (!record) return;
    try {
      await api.del(`/m5/${record.id}`);
      setInfo("Brouillon supprimé.");
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Delete.");
    }
  }

  function updateRow(idx: number, patch: Partial<MatrixRow>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
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
      functionId="MCDESOP"
      screenTitle="M5 - Paramétrage - Event / SOP Impact Matrix"
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
            <Field label="SOP" required readOnly={!!record}>
              <input
                value={form.sop}
                disabled={!!record}
                onChange={(e) => setForm({ ...form, sop: e.target.value })}
                placeholder="Ex: TAG - Transaction Agence"
              />
            </Field>
            <Field label="Effective From" required readOnly={!!record}>
              <input
                type="date"
                value={form.effective_from}
                disabled={!!record}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Status" readOnly>
              <input value={record?.matrix_status ?? "Draft"} disabled />
            </Field>
            <Field label="Version" readOnly>
              <input value={record?.version ?? "-"} disabled />
            </Field>
          </FieldRow>

          <div className="section-title">Grille Event / Impact</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Event</th>
                <th>Impact</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Override</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input style={{ width: 80 }} value={r.event} disabled={!editable} onChange={(e) => updateRow(i, { event: e.target.value.toUpperCase() })} />
                  </td>
                  <td>
                    <select value={r.impact} disabled={!editable} onChange={(e) => updateRow(i, { impact: e.target.value })}>
                      {IMPACTS.map((im) => (
                        <option key={im}>{im}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={r.severity}
                      disabled={!editable}
                      onChange={(e) => updateRow(i, { severity: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input value={r.message} disabled={!editable} onChange={(e) => updateRow(i, { message: e.target.value })} />
                  </td>
                  <td>
                    <select value={r.override} disabled={!editable} onChange={(e) => updateRow(i, { override: e.target.value })}>
                      <option>N</option>
                      <option>Y</option>
                    </select>
                  </td>
                  <td>
                    <select value={r.active} disabled={!editable} onChange={(e) => updateRow(i, { active: e.target.value })}>
                      <option>Y</option>
                      <option>N</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <div className="grid-actions" style={{ marginTop: 8 }}>
              <button onClick={() => setRows((rs) => [...rs, emptyRow()])}>+ Ajouter une ligne</button>
              {rows.length > 1 && <button onClick={() => setRows((rs) => rs.slice(0, -1))}>- Retirer la dernière ligne</button>}
            </div>
          )}
        </>
      )}

      {tab === "Audit" && (
        <>
          <div className="section-title">Historique des versions (append-only)</div>
          {audit.length === 0 && <p className="hint">Aucun historique — exécuter Query pour charger une matrice.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  v{a.version} — {a.status} ({a.matrix_status})
                </span>
                <span>{a.last_action}</span>
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
