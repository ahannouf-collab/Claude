import { useMemo, useState } from "react";
import { ROLE_LABELS, USERS, canOpenScreen, type UserProfile } from "./roles";
import { M1CodeEvent } from "./screens/M1CodeEvent";
import { M2ActiveEvents } from "./screens/M2ActiveEvents";
import { M3EventHistory } from "./screens/M3EventHistory";
import { M4EventReason } from "./screens/M4EventReason";
import { M5SopMatrix } from "./screens/M5SopMatrix";
import { M6RejectionMonitor } from "./screens/M6RejectionMonitor";
import { M7GlobalRestriction } from "./screens/M7GlobalRestriction";
import { M8MclContribution } from "./screens/M8MclContribution";
import { M9CommutationMonitor } from "./screens/M9CommutationMonitor";

interface FunctionDef {
  id: string;
  functionId: string;
  label: string;
  group: "Paramétrage" | "Consultation" | "Exploitation";
}

const FUNCTIONS: FunctionDef[] = [
  { id: "M1", functionId: "MCDCEVNT", label: "Code Event Maintenance", group: "Paramétrage" },
  { id: "M4", functionId: "MCDCEVRS", label: "Event Reason Maintenance", group: "Paramétrage" },
  { id: "M5", functionId: "MCDESOP", label: "Event / SOP Impact Matrix", group: "Paramétrage" },
  { id: "M8", functionId: "MCDMCLMX", label: "MCL Restriction Contribution", group: "Paramétrage" },
  { id: "M2", functionId: "MCSAEVTS", label: "Active Account Events", group: "Consultation" },
  { id: "M3", functionId: "MCDAEVTH", label: "Account Event History", group: "Consultation" },
  { id: "M7", functionId: "MCSAEVST", label: "Account Events & Global Restriction", group: "Consultation" },
  { id: "M6", functionId: "MCSEVREJ", label: "Event Interface Rejection Monitor", group: "Exploitation" },
  { id: "M9", functionId: "MCSMCLMN", label: "MCL Commutation Monitor", group: "Exploitation" },
];

const GROUPS: FunctionDef["group"][] = ["Paramétrage", "Consultation", "Exploitation"];

export default function App() {
  const [userLogin, setUserLogin] = useState(USERS[0].login);
  const user: UserProfile = USERS.find((u) => u.login === userLogin) ?? USERS[0];
  const allowed = useMemo(() => FUNCTIONS.filter((f) => canOpenScreen(user.role, f.id)), [user.role]);
  const [active, setActive] = useState<string>(allowed[0]?.id ?? "M2");

  const currentFn = FUNCTIONS.find((f) => f.id === active) ?? allowed[0];
  const isAllowed = allowed.some((f) => f.id === active);

  function renderScreen() {
    if (!currentFn || !isAllowed) {
      return (
        <div className="eb-window">
          <div className="eb-content">
            <div className="callout error">
              Aucune fonction habilitée pour ce profil, ou accès refusé (RG UAT-10 : action désactivée / tentative
              tracée).
            </div>
          </div>
        </div>
      );
    }
    switch (currentFn.id) {
      case "M1":
        return <M1CodeEvent user={user} />;
      case "M2":
        return <M2ActiveEvents user={user} />;
      case "M3":
        return <M3EventHistory user={user} />;
      case "M4":
        return <M4EventReason user={user} />;
      case "M5":
        return <M5SopMatrix user={user} />;
      case "M6":
        return <M6RejectionMonitor user={user} />;
      case "M7":
        return <M7GlobalRestriction user={user} />;
      case "M8":
        return <M8MclContribution user={user} />;
      case "M9":
        return <M9CommutationMonitor user={user} />;
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <div className="top-header">
        <div className="brand">
          <span className="oracle">ORACLE</span>SFD - Référentiel des Événements Compte - FCUBS
        </div>
        <div className="session-info">
          <span>Bank of Africa / TPOSIG</span>
          <select value={userLogin} onChange={(e) => setUserLogin(e.target.value)}>
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
