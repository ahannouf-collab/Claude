export type Role =
  | "PARAM_MAKER"
  | "PARAM_CHECKER"
  | "AGENCE_MAKER"
  | "AGENCE_CHECKER"
  | "BACKOFFICE_MAKER"
  | "BACKOFFICE_CHECKER"
  | "REACT_MAKER"
  | "REACT_CHECKER"
  | "RECON_OWNER"
  | "RECON_SUPERVISOR"
  | "AUDITOR";

export interface UserProfile {
  login: string;
  name: string;
  role: Role;
}

export const USERS: UserProfile[] = [
  { login: "PARAM.MAKER1", name: "A. Maker Paramétrage", role: "PARAM_MAKER" },
  { login: "PARAM.CHECKER1", name: "B. Checker Paramétrage", role: "PARAM_CHECKER" },
  { login: "AGENCE.MAKER1", name: "C. Chargé d'agence (N1)", role: "AGENCE_MAKER" },
  { login: "AGENCE.CHECKER1", name: "D. Responsable agence (N1)", role: "AGENCE_CHECKER" },
  { login: "BO.MAKER1", name: "E. Analyste back-office (N2)", role: "BACKOFFICE_MAKER" },
  { login: "BO.CHECKER1", name: "F. Responsable back-office (N2)", role: "BACKOFFICE_CHECKER" },
  { login: "REACT.MAKER1", name: "G. Guichetier Réactivation", role: "REACT_MAKER" },
  { login: "REACT.CHECKER1", name: "H. Superviseur Réactivation", role: "REACT_CHECKER" },
  { login: "RECON.OWNER1", name: "I. Support CBS (Réconciliation)", role: "RECON_OWNER" },
  { login: "RECON.SUPERVISOR1", name: "J. Superviseur Pilotage/Réconciliation", role: "RECON_SUPERVISOR" },
  { login: "AUDITOR1", name: "K. Auditeur Conformité", role: "AUDITOR" },
];

export const ROLE_LABELS: Record<Role, string> = {
  PARAM_MAKER: "PARAM_MAKER — Save M01/M02",
  PARAM_CHECKER: "PARAM_CHECKER — Query/Authorize M01/M02",
  AGENCE_MAKER: "AGENCE_MAKER — Décision N1 (Save) M03",
  AGENCE_CHECKER: "AGENCE_CHECKER — Décision N1 (Authorize) M03",
  BACKOFFICE_MAKER: "BACKOFFICE_MAKER — Décision N2 (Save) M04",
  BACKOFFICE_CHECKER: "BACKOFFICE_CHECKER — Décision N2 (Authorize) M04",
  REACT_MAKER: "REACT_MAKER — Saisie réactivation M05",
  REACT_CHECKER: "REACT_CHECKER — Autorisation réactivation M06",
  RECON_OWNER: "RECON_OWNER — Investigation anomalies M08",
  RECON_SUPERVISOR: "RECON_SUPERVISOR — Résolution M08 + Pilotage M09",
  AUDITOR: "AUDITOR — Consultation/Audit transverse (lecture seule)",
};

const SCREEN_ACCESS: Record<Role, string[]> = {
  PARAM_MAKER: ["M01", "M02"],
  PARAM_CHECKER: ["M01", "M02"],
  AGENCE_MAKER: ["M03"],
  AGENCE_CHECKER: ["M03"],
  BACKOFFICE_MAKER: ["M04"],
  BACKOFFICE_CHECKER: ["M04"],
  REACT_MAKER: ["M05"],
  REACT_CHECKER: ["M06"],
  RECON_OWNER: ["M08"],
  RECON_SUPERVISOR: ["M07", "M08", "M09"],
  AUDITOR: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09"],
};

const MAKER_ROLES: Role[] = ["PARAM_MAKER", "AGENCE_MAKER", "BACKOFFICE_MAKER", "REACT_MAKER", "RECON_OWNER"];
const CHECKER_ROLES: Role[] = ["PARAM_CHECKER", "AGENCE_CHECKER", "BACKOFFICE_CHECKER", "REACT_CHECKER", "RECON_SUPERVISOR"];

export function canOpenScreen(role: Role, screen: string): boolean {
  return SCREEN_ACCESS[role]?.includes(screen) ?? false;
}

/** New / Enter Query / Execute Query / Save / Delete. */
export function canMaintain(role: Role): boolean {
  return MAKER_ROLES.includes(role);
}

/** Authorize (contrôle dual — Checker distinct du Maker). */
export function canAuthorize(role: Role): boolean {
  return CHECKER_ROLES.includes(role);
}

export function isReadOnly(role: Role): boolean {
  return role === "AUDITOR";
}

/** M09 - Pilotage batch et KPI : déclenchement du batch EOD. */
export function canRunBatch(role: Role): boolean {
  return role === "RECON_SUPERVISOR";
}
