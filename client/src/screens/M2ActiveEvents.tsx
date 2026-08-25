import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import type { UserProfile } from "../roles";

interface Account {
  account_no: string;
  customer_id: string;
  customer_name: string;
  account_status: string;
}
interface EventItem {
  event: string;
  domain: string;
  pose_date: string;
  case_dossier: string;
  source: string;
  contribution: string | null;
}

export function M2ActiveEvents({ user }: { user: UserProfile }) {
  const [accountNo, setAccountNo] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery() {
    setError(null);
    if (!accountNo) {
      setError("Account/RIB est obligatoire pour lancer la consultation (RG-M2-01).");
      return;
    }
    try {
      const data = await api.get<{ account: Account; events: EventItem[] }>(`/m2/${encodeURIComponent(accountNo)}`);
      setAccount(data.account);
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Compte introuvable.");
      setAccount(null);
      setEvents([]);
    }
  }

  function reset() {
    setAccountNo("");
    setAccount(null);
    setEvents([]);
    setError(null);
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "query", label: "Query", onClick: handleQuery, variant: "primary" },
    { key: "print", label: "Print", onClick: () => window.print(), disabled: !account },
    { key: "close", label: "Close", onClick: reset },
  ];

  return (
    <EnterpriseShell
      functionId="MCSAEVTS"
      screenTitle="M2 - Consultation - Active Account Events"
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
        <Field label="Customer" readOnly>
          <input value={account ? `${account.customer_id} - ${account.customer_name}` : ""} disabled />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Domain" readOnly>
          <input value="All Domains" disabled />
        </Field>
        <Field label="Account Status" readOnly>
          <input value={account?.account_status ?? ""} disabled />
        </Field>
      </FieldRow>

      <table className="eb-grid">
        <thead>
          <tr>
            <th>Event</th>
            <th>Domain</th>
            <th>Date Pose</th>
            <th>Case / Dossier</th>
            <th>Contribution</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td>{e.event}</td>
              <td>{e.domain}</td>
              <td>{e.pose_date}</td>
              <td>{e.case_dossier}</td>
              <td>{e.contribution ?? "-"}</td>
              <td>{e.source}</td>
            </tr>
          ))}
          {account && events.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#5b6b7a" }}>
                Aucun événement actif sur ce compte.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Callout>Contextual behavior: écran strictement read-only ; aucune action Save/Submit/Authorize ne produit de persistance (RG-M2-06).</Callout>
    </EnterpriseShell>
  );
}
