import { useState } from "react";
import { api, ApiError } from "../api";
import { EnterpriseShell, type ToolbarButtonDef } from "../components/EnterpriseShell";
import { Callout, Field, FieldRow } from "../components/Field";
import type { UserProfile } from "../roles";

interface Account {
  account_no: string;
  customer_id: string;
  customer_name: string;
}
interface EventItem {
  event: string;
  contribution: string | null;
  pose_date: string;
  source: string;
  case_ref: string;
}
interface M7Data {
  account: Account;
  events: EventItem[];
  global_restriction: string;
  native_restriction: string;
  last_commutation: string | null;
  mismatch: boolean;
}

export function M7GlobalRestriction({ user }: { user: UserProfile }) {
  const [accountNo, setAccountNo] = useState("");
  const [data, setData] = useState<M7Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleQuery() {
    setError(null);
    setInfo(null);
    if (!accountNo) {
      setError("Account/RIB est obligatoire (RG-M7-01).");
      return;
    }
    try {
      setData(await api.get<M7Data>(`/m7/${encodeURIComponent(accountNo)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Compte introuvable.");
      setData(null);
    }
  }

  async function handleRecalculate() {
    if (!accountNo) return;
    try {
      const result = await api.post<{ recalculated_restriction: string; ts: string }>(`/m7/${encodeURIComponent(accountNo)}/recalculate`);
      setInfo(`Recalcul MCL : ${result.recalculated_restriction} (${new Date(result.ts).toLocaleString("fr-FR")}). Aucune écriture depuis cet écran.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du Recalculate.");
    }
  }

  function reset() {
    setAccountNo("");
    setData(null);
    setError(null);
    setInfo(null);
  }

  const toolbar: ToolbarButtonDef[] = [
    { key: "query", label: "Query", onClick: handleQuery, variant: "primary" },
    { key: "recalculate", label: "Recalculate", onClick: handleRecalculate, disabled: !data },
    { key: "print", label: "Print", onClick: () => window.print(), disabled: !data },
    { key: "close", label: "Close", onClick: reset },
  ];

  return (
    <EnterpriseShell
      functionId="MCSAEVST"
      screenTitle="M7 - Consultation - Account Events & Global Restriction"
      toolbar={toolbar}
      tabs={[{ key: "Main", label: "Main" }]}
      activeTab="Main"
      onTabChange={() => {}}
      user={user.login}
      footer={{ recordStatus: data ? "View / Operational" : undefined, statusVariant: "view", version: "-", lastAction: data ? "Query" : "-" }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      {info && !error && <Callout variant="info">{info}</Callout>}
      <FieldRow>
        <Field label="Account / RIB" required>
          <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="0117800001600100123456" />
        </Field>
        <Field label="Customer" readOnly>
          <input value={data ? `${data.account.customer_id} - ${data.account.customer_name}` : ""} disabled />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Global Restriction (MCL)" readOnly>
          <input value={data?.global_restriction ?? ""} disabled />
        </Field>
        <Field label="Last Commutation" readOnly>
          <input value={data?.last_commutation ? new Date(data.last_commutation).toLocaleString("fr-FR") : ""} disabled />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Native FCUBS Value (opposable)" readOnly>
          <input value={data?.native_restriction ?? ""} disabled />
        </Field>
        <Field label="Écart MCL / FCUBS" readOnly>
          <input value={data ? (data.mismatch ? "Écart détecté" : "Cohérent") : ""} disabled />
        </Field>
      </FieldRow>
      {data?.mismatch && (
        <Callout variant="error">Écart MCL/FCUBS signalé (RG-M7-06). La correction se fait via M9 - MCL Commutation Monitor, pas depuis cet écran.</Callout>
      )}

      <table className="eb-grid">
        <thead>
          <tr>
            <th>Event</th>
            <th>Contribution</th>
            <th>Pose Date</th>
            <th>Source</th>
            <th>Case Ref</th>
          </tr>
        </thead>
        <tbody>
          {(data?.events ?? []).map((e, i) => (
            <tr key={i}>
              <td>{e.event}</td>
              <td>{e.contribution ?? "-"}</td>
              <td>{e.pose_date}</td>
              <td>{e.source}</td>
              <td>{e.case_ref}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Callout>Contextual behavior: écran read-only ; Recalculate appelle le service MCL sans écriture directe (RG-M7-06).</Callout>
    </EnterpriseShell>
  );
}
