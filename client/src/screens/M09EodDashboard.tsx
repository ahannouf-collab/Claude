import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canRunBatch, type UserProfile } from "../roles";

interface Kpis {
  eligibleCustomers: number;
  pendingN1: number;
  pendingN2: number;
  reactivationsToday: number;
  exceptionsOpen: number;
}

const TILES: { key: keyof Kpis; drill: string; label: string }[] = [
  { key: "eligibleCustomers", drill: "eligible-customers", label: "Eligible Customers" },
  { key: "pendingN1", drill: "pending-n1", label: "Pending N1" },
  { key: "pendingN2", drill: "pending-n2", label: "Pending N2" },
  { key: "reactivationsToday", drill: "reactivations", label: "Reactivations" },
  { key: "exceptionsOpen", drill: "exceptions", label: "Exceptions" },
];

export function M09EodDashboard({ user }: { user: UserProfile }) {
  const [businessDate, setBusinessDate] = useState("");
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [lastRun, setLastRun] = useState<any>(null);
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canRun = canRunBatch(user.role);

  async function loadKpis(date?: string) {
    setError(null);
    try {
      const data = await api.get<{ businessDate: string; kpis: Kpis; lastRun: any }>(`/m09/kpis${date ? `?businessDate=${date}` : ""}`);
      setBusinessDate(data.businessDate);
      setKpis(data.kpis);
      setLastRun(data.lastRun);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  async function loadRuns() {
    setRuns(await api.get<any[]>("/m09/runs"));
  }

  useEffect(() => {
    loadKpis();
    loadRuns();
  }, []);

  async function drill(key: string) {
    setSelectedDrill(key);
    try {
      const rows = await api.get<any[]>(`/m09/drilldown/${key}?businessDate=${businessDate}`);
      setDrillRows(rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de chargement.");
    }
  }

  async function runBatch() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/m09/run", { businessDate, actorLogin: user.login, actorRole: user.role });
      await loadKpis(businessDate);
      await loadRuns();
      if (selectedDrill) drill(selectedDrill);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'exécution du batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EnterpriseShell
      functionId="BOA.DESH.EOD.DASHBOARD"
      screenTitle="M09 - Pilotage batch et KPI"
      user={user.login}
      toolbar={[
        { key: "exec", label: "Execute Query", onClick: () => loadKpis(businessDate) },
        { key: "run", label: busy ? "Exécution..." : "Run EOD Batch", onClick: runBatch, disabled: !canRun || busy, variant: "primary" },
        { key: "close", label: "Close", onClick: () => setSelectedDrill(null) },
      ]}
      tabs={[{ key: "main", label: "Main" }]}
      activeTab="main"
      onTabChange={() => {}}
      footer={{
        recordStatus: lastRun ? `Dernière exécution: ${lastRun.ran_ts}` : "Aucune exécution pour cette date",
        statusVariant: "view",
        maker: lastRun?.triggered_by,
      }}
    >
      {error && <Callout variant="error">{error}</Callout>}
      {!canRun && <Callout variant="info">Votre profil ne permet pas de déclencher le batch — consultation seule.</Callout>}

      <div className="search-bar">
        <Field label="Business Date">
          <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} disabled={!canRun} />
        </Field>
        <button onClick={() => loadKpis(businessDate)}>Charger</button>
      </div>

      {kpis && (
        <div className="kpi-grid">
          {TILES.map((t) => (
            <button key={t.key} className={`kpi-tile${selectedDrill === t.drill ? " selected" : ""}`} onClick={() => drill(t.drill)}>
              <div className="kpi-value">{kpis[t.key]}</div>
              <div className="kpi-label">{t.label}</div>
            </button>
          ))}
        </div>
      )}

      {selectedDrill && (
        <>
          <div className="section-title">Détail — {TILES.find((t) => t.drill === selectedDrill)?.label}</div>
          <table className="eb-grid">
            <thead>
              <tr>
                {drillRows[0] &&
                  Object.keys(drillRows[0]).map((k) => <th key={k}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {drillRows.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j}>{String(v ?? "-")}</td>
                  ))}
                </tr>
              ))}
              {drillRows.length === 0 && (
                <tr>
                  <td className="hint">Aucun dossier sous-jacent pour cet indicateur.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">RG-08 : chaque agrégat doit se rapprocher des dossiers sous-jacents affichés ci-dessus.</p>
        </>
      )}

      <div className="section-title" style={{ marginTop: 18 }}>
        Historique des exécutions batch (append-only)
      </div>
      <table className="eb-grid">
        <thead>
          <tr>
            <th>Business Date</th>
            <th>Ran At</th>
            <th>Triggered By</th>
            <th>Dossiers créés</th>
            <th>Décisions créées</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>{r.business_date}</td>
              <td>{r.ran_ts}</td>
              <td>{r.triggered_by}</td>
              <td>{r.dossiers_created}</td>
              <td>{r.decisions_created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnterpriseShell>
  );
}
