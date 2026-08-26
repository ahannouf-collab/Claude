import { useMemo, useState } from "react";
import { ROLE_LABELS, USERS, canOpenScreen, type UserProfile } from "./roles";
import { M01Parameter } from "./screens/M01Parameter";
import { M02Eligibility } from "./screens/M02Eligibility";
import { M03DecisionN1 } from "./screens/M03DecisionN1";
import { M04DecisionN2 } from "./screens/M04DecisionN2";
import { M05Reactivate } from "./screens/M05Reactivate";
import { M06ReactivateAuth } from "./screens/M06ReactivateAuth";
import { M07CifInquiry } from "./screens/M07CifInquiry";
import { M08Reconciliation } from "./screens/M08Reconciliation";
import { M09EodDashboard } from "./screens/M09EodDashboard";

interface FunctionDef {
  id: string;
  functionId: string;
  label: string;
  group: "Paramétrage" | "Décisions" | "Réactivation" | "Consultation" | "Pilotage";
}

const FUNCTIONS: FunctionDef[] = [
  { id: "M01", functionId: "BOA.DESH.PARAM", label: "Paramétrage seuils, délais et workflow", group: "Paramétrage" },
  { id: "M02", functionId: "BOA.DESH.ELIG", label: "Catégories, transactions BANK et comptes indisponibles", group: "Paramétrage" },
  { id: "M03", functionId: "BOA.DESH.N1.WORKLIST", label: "Décision agence N1", group: "Décisions" },
  { id: "M04", functionId: "BOA.DESH.N2.WORKLIST", label: "Décision back-office N2", group: "Décisions" },
  { id: "M05", functionId: "BOA.DESH.REACTIVATE", label: "Saisie réactivation manuelle", group: "Réactivation" },
  { id: "M06", functionId: "BOA.DESH.REACT.AUTH", label: "Autorisation réactivation", group: "Réactivation" },
  { id: "M07", functionId: "BOA.DESH.CIF.INQUIRY", label: "Consultation Tiers et comptes", group: "Consultation" },
  { id: "M08", functionId: "BOA.DESH.RECON.EXC", label: "Anomalies et réconciliation", group: "Pilotage" },
  { id: "M09", functionId: "BOA.DESH.EOD.DASHBOARD", label: "Pilotage batch et KPI", group: "Pilotage" },
];

const GROUPS: FunctionDef["group"][] = ["Paramétrage", "Décisions", "Réactivation", "Consultation", "Pilotage"];

export default function App() {
  const [userLogin, setUserLogin] = useState(USERS[0].login);
  const user: UserProfile = USERS.find((u) => u.login === userLogin) ?? USERS[0];
  const allowed = useMemo(() => FUNCTIONS.filter((f) => canOpenScreen(user.role, f.id)), [user.role]);
  const [active, setActive] = useState<string>(allowed[0]?.id ?? "M01");

  const currentFn = FUNCTIONS.find((f) => f.id === active) ?? allowed[0];
  const isAllowed = allowed.some((f) => f.id === active);

  function handleSelectUser(login: string) {
    setUserLogin(login);
    const nextAllowed = FUNCTIONS.filter((f) => canOpenScreen(USERS.find((u) => u.login === login)!.role, f.id));
    if (!nextAllowed.some((f) => f.id === active)) setActive(nextAllowed[0]?.id ?? "M01");
  }

  function renderScreen() {
    if (!currentFn || !isAllowed) {
      return (
        <div className="eb-window">
          <div className="eb-content">
            <div className="callout error">
              Aucune fonction habilitée pour ce profil, ou accès refusé (RG-01 : accès contrôlé par rôle — tentative
              tracée).
            </div>
          </div>
        </div>
      );
    }
    switch (currentFn.id) {
      case "M01":
        return <M01Parameter user={user} />;
      case "M02":
        return <M02Eligibility user={user} />;
      case "M03":
        return <M03DecisionN1 user={user} />;
      case "M04":
        return <M04DecisionN2 user={user} />;
      case "M05":
        return <M05Reactivate user={user} />;
      case "M06":
        return <M06ReactivateAuth user={user} />;
      case "M07":
        return <M07CifInquiry user={user} />;
      case "M08":
        return <M08Reconciliation user={user} />;
      case "M09":
        return <M09EodDashboard user={user} />;
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="brand">
          <span className="oracle">ORACLE</span>SFD Mockups Déshérence — FCUBS
        </div>
        <div className="session-info">
          <span>Bank of Africa / TPOSIG</span>
          <select value={userLogin} onChange={(e) => handleSelectUser(e.target.value)}>
            {USERS.map((u) => (
              <option key={u.login} value={u.login}>
                {u.login} - {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="app-body">
        <div className="sidebar">
          <div style={{ padding: "0 12px 8px", fontSize: 11, color: "#5b6b7a" }}>{ROLE_LABELS[user.role]}</div>
          {GROUPS.map((g) => {
            const items = allowed.filter((f) => f.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <h4>{g}</h4>
                {items.map((f) => (
                  <button
                    key={f.id}
                    className={`nav-item${f.id === active ? " active" : ""}`}
                    onClick={() => setActive(f.id)}
                  >
                    {f.id} - {f.label}
                    <span className="fid">{f.functionId}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="main-area">{renderScreen()}</div>
      </div>
    </div>
  );
}
