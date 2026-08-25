import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import type { UserProfile } from "../roles";

interface Account {
  account_no: string;
  customer_name: string;
}
interface HistItem {
  event: string;
  pose_date: string;
  levee_date: string | null;
  motif: string;
  source: string;
  archive_ref: string;
}

export function M3EventHistory({ user }: { user: UserProfile }) {
  const [accountNo, setAccountNo] = useState("");
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-08-10");
  const [eventCode, setEventCode] = useState("All");
  const [account, setAccount] = useState<Account | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery() {
    setError(null);
    if (!accountNo || !fromDate || !toDate) {
      setError("Account/RIB, From Date et To Date sont obligatoires (RG-M3-01).");
      return;
    }
    if (fromDate > toDate) {
      setError("From Date doit être <= To Date (RG-M3-01).");
      return;
    }
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate, event_code: eventCode });
      const data = await api.get<{ account: Account; history: HistItem[] }>(`/m3/${encodeURIComponent(accountNo)}?${params}`);
      setAccount(data.account);
      setHistory(data.history);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Compte introuvable.");
      setAccount(null);
      setHistory([]);
    }
  }

  function reset() {
    setAccountNo("");
    setAccount(null);
    setHistory([]);
    setError(null);
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "query", label: "Query", onClick: handleQuery, variant: "primary" },
    { key: "print", label: "Print", onClick: () => window.print(), disabled: !account },
    { key: "close", label: "Close", onClick: reset },
  ];

  return (
    <EnterpriseShell
      functionId="MCDAEVTH"
      screenTitle="M3 - Consultation - Account Event History"
      toolbar={toolbar}
      tabs={[{ key: "Main", label: "Main" }]}
      activeTab="Main"
      onTabChange={() => {}}
      user={user.login}
      footer={{ recordStatus: account ? "View / Operational" : undefined, statusVariant: "view", version: "-", lastAction: account ? "Query" : "-" }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      <FieldRow>
        <Field label="Account / RIB" required>
          <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="0117800001600100123456" />
        </Field>
        <Field label="Event Code">
          <input value={eventCode} onChange={(e) => setEventCode(e.target.value.toUpperCase())} placeholder="All" />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="From Date" required>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="To Date" required>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
      </FieldRow>

      <table className="eb-grid">
        <thead>
          <tr>
            <th>Event</th>
            <th>Pose</th>
            <th>Levée</th>
            <th>Motif</th>
            <th>Source</th>
            <th>Archive Ref</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i}>
              <td>{h.event}</td>
              <td>{h.pose_date}</td>
              <td>{h.levee_date ?? "-"}</td>
              <td>{h.motif}</td>
              <td>{h.source}</td>
              <td>{h.archive_ref}</td>
            </tr>
          ))}
          {account && history.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#5b6b7a" }}>
                Aucun historique sur la période.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Callout>Contextual behavior: les données proviennent de l'historique append-only et ne sont jamais réécrites par l'écran (RG-M3-03).</Callout>
    </EnterpriseShell>
  );
}
