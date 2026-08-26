import { useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import type { UserProfile } from "../roles";

interface InquiryResult {
  customer: { cif: string; full_name: string; segment: string; branch: string };
  accounts: { account_no: string; product_label: string; currency: string; book_balance: number; status: string; last_movement_date: string }[];
  dossiers: { business_date: string; eligibility_status: string; max_inactive_days: number; total_balance: number; reason: string | null }[];
  decisionsN1: { account_no: string; decision: string; status: string; motif: string | null }[];
  decisionsN2: { account_no: string; decision: string; status: string; motif: string | null }[];
  reactivations: { account_no: string; reactivation_reason: string; decision: string | null; status: string }[];
  exceptions: { exception_id: string; account_no: string; exception_type: string; cycle_status: string }[];
  lastUpdate: string;
}

export function M07CifInquiry({ user }: { user: UserProfile }) {
  const [cif, setCif] = useState("");
  const [account, setAccount] = useState("");
  const [result, setResult] = useState<InquiryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function executeQuery() {
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ cif, actorLogin: user.login, actorRole: user.role });
      if (account) params.set("account", account);
      const data = await api.get<InquiryResult>(`/m07/inquiry?${params.toString()}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de consultation.");
    }
  }

  return (
    <EnterpriseShell
      functionId="BOA.DESH.CIF.INQUIRY"
      screenTitle="M07 - Consultation Tiers et comptes"
      user={user.login}
      toolbar={[
        { key: "query", label: "Enter Query", onClick: () => setResult(null) },
        { key: "exec", label: "Execute Query", onClick: executeQuery, variant: "primary" },
        { key: "close", label: "Close", onClick: () => { setResult(null); setCif(""); setAccount(""); } },
      ]}
      tabs={[{ key: "main", label: "Main" }]}
      activeTab="main"
      onTabChange={() => {}}
      footer={{ recordStatus: undefined }}
    >
      {error && <Callout variant="error">{error}</Callout>}

      <div className="search-bar">
        <Field label="Customer / CIF" required>
          <input value={cif} onChange={(e) => setCif(e.target.value)} />
        </Field>
        <Field label="Account (optionnel)">
          <input value={account} onChange={(e) => setAccount(e.target.value)} />
        </Field>
        <button onClick={executeQuery}>Rechercher</button>
      </div>

      {result && (
        <>
          <div className="section-title">Tiers</div>
          <table className="eb-grid">
            <tbody>
              <tr>
                <th>CIF</th>
                <td>{result.customer.cif}</td>
                <th>Nom</th>
                <td>{result.customer.full_name}</td>
              </tr>
              <tr>
                <th>Segment</th>
                <td>{result.customer.segment}</td>
                <th>Branch</th>
                <td>{result.customer.branch}</td>
              </tr>
            </tbody>
          </table>

          <div className="section-title" style={{ marginTop: 16 }}>
            Comptes
          </div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Account</th>
                <th>Product</th>
                <th>Book Balance</th>
                <th>Dormancy Status</th>
                <th>Last Movement</th>
              </tr>
            </thead>
            <tbody>
              {result.accounts.map((a) => (
                <tr key={a.account_no}>
                  <td>{a.account_no}</td>
                  <td>{a.product_label}</td>
                  <td>
                    {a.book_balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {a.currency}
                  </td>
                  <td>
                    <span className={`badge badge-${a.status}`}>{a.status}</span>
                  </td>
                  <td>{a.last_movement_date}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title" style={{ marginTop: 16 }}>
            Historique d'éligibilité
          </div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Business Date</th>
                <th>Eligibility Status</th>
                <th>Max Inactive Days</th>
                <th>Total Balance</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.dossiers.map((d, i) => (
                <tr key={i}>
                  <td>{d.business_date}</td>
                  <td>
                    <span className={`badge badge-${d.eligibility_status}`}>{d.eligibility_status}</span>
                  </td>
                  <td>{d.max_inactive_days}</td>
                  <td>{d.total_balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</td>
                  <td>{d.reason ?? "-"}</td>
                </tr>
              ))}
              {result.dossiers.length === 0 && (
                <tr>
                  <td colSpan={5} className="hint">
                    Aucun dossier d'éligibilité.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title" style={{ marginTop: 16 }}>
            Décisions N1 / N2
          </div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Niveau</th>
                <th>Account</th>
                <th>Decision</th>
                <th>Auth Status</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {result.decisionsN1.map((d, i) => (
                <tr key={`n1-${i}`}>
                  <td>N1</td>
                  <td>{d.account_no}</td>
                  <td>
                    <span className={`badge badge-${d.decision}`}>{d.decision}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${d.status}`}>{d.status}</span>
                  </td>
                  <td>{d.motif ?? "-"}</td>
                </tr>
              ))}
              {result.decisionsN2.map((d, i) => (
                <tr key={`n2-${i}`}>
                  <td>N2</td>
                  <td>{d.account_no}</td>
                  <td>
                    <span className={`badge badge-${d.decision}`}>{d.decision}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${d.status}`}>{d.status}</span>
                  </td>
                  <td>{d.motif ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title" style={{ marginTop: 16 }}>
            Réactivations
          </div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Account</th>
                <th>Reason</th>
                <th>Decision</th>
                <th>Auth Status</th>
              </tr>
            </thead>
            <tbody>
              {result.reactivations.map((r, i) => (
                <tr key={i}>
                  <td>{r.account_no}</td>
                  <td>{r.reactivation_reason}</td>
                  <td>{r.decision ?? "-"}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
              {result.reactivations.length === 0 && (
                <tr>
                  <td colSpan={4} className="hint">
                    Aucune réactivation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="section-title" style={{ marginTop: 16 }}>
            Anomalies
          </div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Exception ID</th>
                <th>Account</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.exceptions.map((e) => (
                <tr key={e.exception_id}>
                  <td>{e.exception_id}</td>
                  <td>{e.account_no}</td>
                  <td>{e.exception_type}</td>
                  <td>
                    <span className={`badge badge-${e.cycle_status}`}>{e.cycle_status}</span>
                  </td>
                </tr>
              ))}
              {result.exceptions.length === 0 && (
                <tr>
                  <td colSpan={4} className="hint">
                    Aucune anomalie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="hint">Last Update: {result.lastUpdate} — consultation auditée (RG-06).</p>
        </>
      )}
    </EnterpriseShell>
  );
}
