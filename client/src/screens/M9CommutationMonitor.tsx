import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import { canExploitAction, type UserProfile } from "../roles";

interface Job {
  id: number;
  job_ref: string;
  account_no: string;
  theoretical: string;
  fcubs_value: string;
  mode: string;
  status: string;
  retry_count: number;
  ts: string;
}

export function M9CommutationMonitor({ user }: { user: UserProfile }) {
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [mode, setMode] = useState("All - RT / Batch");
  const [mismatchOnly, setMismatchOnly] = useState("Y");
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<Job[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [queried, setQueried] = useState(false);

  async function handleQuery() {
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams({ from_date: fromDate, mode, mismatch_only: mismatchOnly, status });
      setRows(await api.get<Job[]>(`/m9?${params}`));
      setQueried(true);
      setSelected(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de la recherche.");
    }
  }

  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const canAct = canExploitAction(user.role, "M9");

  async function handleRetry() {
    if (!selectedRow) return;
    setError(null);
    setInfo(null);
    try {
      const updated = await api.post<Job>(`/m9/${selectedRow.id}/retry`);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      setInfo(`Correction appliquée (idempotente, tentative #${updated.retry_count}) — FCUBS aligné sur la valeur théorique MCL.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de la correction.");
    }
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "query", label: "Query", onClick: handleQuery, variant: "primary" },
    { key: "retry", label: "Retry / Recalculate", onClick: handleRetry, disabled: !canAct || !selectedRow || selectedRow.status === "Corrected" },
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
      functionId="MCSMCLMN"
      screenTitle="M9 - Exploitation - MCL Commutation Monitor"
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
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option>All - RT / Batch</option>
            <option>RT</option>
            <option>Batch</option>
          </select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Mismatch Only">
          <select value={mismatchOnly} onChange={(e) => setMismatchOnly(e.target.value)}>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            <option>Mismatch</option>
            <option>Investigating</option>
            <option>Corrected</option>
          </select>
        </Field>
      </FieldRow>

      <table className="eb-grid">
        <thead>
          <tr>
            <th>Job/Ref</th>
            <th>Account</th>
            <th>Theoretical</th>
            <th>FCUBS</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Retry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.id === selected ? "selected" : ""} onClick={() => setSelected(r.id)}>
              <td>{r.job_ref}</td>
              <td>…{r.account_no.slice(-4)}</td>
              <td>{r.theoretical}</td>
              <td>{r.fcubs_value}</td>
              <td>{r.mode}</td>
              <td>{r.status}</td>
              <td>{r.retry_count}</td>
            </tr>
          ))}
          {queried && rows.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "#5b6b7a" }}>
                Aucun job ne correspond aux filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Callout>Contextual behavior: la correction UPDATE FCUBS seulement si la relecture confirme l'écart ; commande idempotente avec correlation-id (RG-M9-05/06).</Callout>
    </EnterpriseShell>
  );
}
