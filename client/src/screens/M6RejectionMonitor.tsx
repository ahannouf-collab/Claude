import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canExploitAction, type UserProfile } from "../roles";

interface Reject {
  id: number;
  reject_id: string;
  ts: string;
  source: string;
  event_code: string;
  code: string;
  reject_type: string;
  status: string;
  retry_count: number;
}

export function M6RejectionMonitor({ user }: { user: UserProfile }) {
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [rejectType, setRejectType] = useState("All");
  const [source, setSource] = useState("All Applications");
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<Reject[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [queried, setQueried] = useState(false);

  async function handleQuery() {
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams({ from_date: fromDate, reject_type: rejectType, source, status });
      setRows(await api.get<Reject[]>(`/m6?${params}`));
      setQueried(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de la recherche.");
    }
  }

  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const canAct = canExploitAction(user.role, "M6");

  async function handleRetry() {
    if (!selectedRow) return;
    setError(null);
    setInfo(null);
    try {
      const updated = await api.post<Reject>(`/m6/${selectedRow.id}/retry`);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      setInfo(`Retry lancé (tentative #${updated.retry_count}) — corrélation journalisée.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Retry.");
    }
  }

  async function handleClose() {
    if (!selectedRow) return;
    try {
      const updated = await api.post<Reject>(`/m6/${selectedRow.id}/close`);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Close.");
    }
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "query", label: "Query", onClick: handleQuery, variant: "primary" },
    { key: "retry", label: "Retry", onClick: handleRetry, disabled: !canAct || !selectedRow || selectedRow.status === "Closed" },
    { key: "close-row", label: "Close Reject", onClick: handleClose, disabled: !canAct || !selectedRow || selectedRow.status === "Closed" },
    { key: "print", label: "Print", onClick: () => window.print(), disabled: !queried },
    {
      key: "close",
      label: "Close",
      onClick: () => {
        setRows([]);
        setQueried(false);
        setSelected(null);
        setError(null);
        setInfo(null);
      },
    },
  ];

  return (
    <EnterpriseShell
      functionId="MCSEVREJ"
      screenTitle="M6 - Exploitation - Event Interface Rejection Monitor"
      toolbar={toolbar}
      tabs={[{ key: "Main", label: "Main" }]}
      activeTab="Main"
      onTabChange={() => {}}
      user={user.login}
      footer={{ recordStatus: queried ? "View / Operational" : undefined, statusVariant: "view", version: "-", lastAction: queried ? "Query" : "-" }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      {info && !error && <Callout variant="info">{info}</Callout>}
      <FieldRow>
        <Field label="From Date" required>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="Reject Type">
          <select value={rejectType} onChange={(e) => setRejectType(e.target.value)}>
            <option>All</option>
            <option>Functional</option>
            <option>Technical</option>
          </select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option>All Applications</option>
            <option>GEL_APP</option>
            <option>ATD_APP</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            <option>Open</option>
            <option>Investigating</option>
            <option>Closed</option>
          </select>
        </Field>
      </FieldRow>

      <table className="eb-grid">
        <thead>
          <tr>
            <th>Reject ID</th>
            <th>Timestamp</th>
            <th>Source</th>
            <th>Event</th>
            <th>Code</th>
            <th>Status</th>
            <th>Retry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.id === selected ? "selected" : ""} onClick={() => setSelected(r.id)}>
              <td>{r.reject_id}</td>
              <td>{r.ts}</td>
              <td>{r.source}</td>
              <td>{r.event_code}</td>
              <td>{r.code}</td>
              <td>{r.status}</td>
              <td>{r.retry_count}</td>
            </tr>
          ))}
          {queried && rows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "#5b6b7a" }}>
                Aucun rejet ne correspond aux filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Callout>Contextual behavior: Retry agit via un service idempotent et journalisé sans jamais modifier la ligne source (RG-M6-05/06).</Callout>
    </EnterpriseShell>
  );
}
