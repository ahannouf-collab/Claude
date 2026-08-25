export type Role =
  | "FCUBS_VIEWER"
  | "FCUBS_PARAM_MAKER"
  | "FCUBS_PARAM_CHECKER"
  | "FCUBS_OPS_N2"
  | "FCUBS_OPS_SENIOR"
  | "FCUBS_AUDITOR";

export interface UserProfile {
  login: string;
  name: string;
  role: Role;
}

export const USERS: UserProfile[] = [
  { login: "TPOSIG01", name: "A. Maker (Paramétrage)", role: "FCUBS_PARAM_MAKER" },
  { login: "TPOSIG02", name: "B. Checker (Paramétrage)", role: "FCUBS_PARAM_CHECKER" },
  { login: "TPOSIG03", name: "C. Support (Consultation)", role: "FCUBS_VIEWER" },
  { login: "TPOSIG04", name: "D. Exploitation N2", role: "FCUBS_OPS_N2" },
  { login: "TPOSIG05", name: "E. Exploitation Senior", role: "FCUBS_OPS_SENIOR" },
  { login: "TPOSIG06", name: "F. Auditeur", role: "FCUBS_AUDITOR" },
];

export const ROLE_LABELS: Record<Role, string> = {
  FCUBS_VIEWER: "FCUBS_VIEWER — Consultation M2/M3/M7",
  FCUBS_PARAM_MAKER: "FCUBS_PARAM_MAKER — Save/Submit M1/M4/M5/M8",
  FCUBS_PARAM_CHECKER: "FCUBS_PARAM_CHECKER — Query/Authorize",
  FCUBS_OPS_N2: "FCUBS_OPS_N2 — M6 consultation + retry ciblé",
  FCUBS_OPS_SENIOR: "FCUBS_OPS_SENIOR — M9 + bulk reconcile",
  FCUBS_AUDITOR: "FCUBS_AUDITOR — Consultation Audit/History",
};

const MAINTENANCE_SCREENS = ["M1", "M4", "M5", "M8"];
const CONSULTATION_SCREENS = ["M2", "M3", "M7"];
const EXPLOITATION_SCREENS = ["M6", "M9"];

export function canOpenScreen(role: Role, screen: string): boolean {
  if (role === "FCUBS_AUDITOR") return true;
  if (role === "FCUBS_VIEWER") return CONSULTATION_SCREENS.includes(screen);
  if (role === "FCUBS_PARAM_MAKER" || role === "FCUBS_PARAM_CHECKER") return MAINTENANCE_SCREENS.includes(screen);
  if (role === "FCUBS_OPS_N2") return screen === "M6";
  if (role === "FCUBS_OPS_SENIOR") return EXPLOITATION_SCREENS.includes(screen);
  return false;
}

export function canMaintain(role: Role): boolean {
  return role === "FCUBS_PARAM_MAKER";
}

export function canAuthorize(role: Role): boolean {
  return role === "FCUBS_PARAM_CHECKER";
}

export function canExploitAction(role: Role, screen: "M6" | "M9"): boolean {
  if (role === "FCUBS_OPS_SENIOR") return true;
  if (role === "FCUBS_OPS_N2") return screen === "M6";
  return false;
}
