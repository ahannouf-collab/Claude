export const VILLES_MAROC = [
  "Casablanca",
  "Rabat",
  "Fès",
  "Marrakech",
  "Tanger",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Salé",
  "Témara",
  "Safi",
  "Mohammédia",
  "El Jadida",
  "Béni Mellal",
  "Nador",
  "Khouribga",
  "Settat",
  "Larache",
];

export const MUTUELLES = ["CNSS", "CNOPS", "AMO", "Privée", "Aucune"] as const;

export const MODES_PAIEMENT = [
  { value: "especes", label: "Espèces" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "mutuelle", label: "Mutuelle / Prise en charge" },
  { value: "cheque", label: "Chèque" },
];

export const STATUTS_RDV: Record<string, { label: string; color: string }> = {
  planifie: { label: "Planifié", color: "#6b7280" },
  confirme: { label: "Confirmé", color: "#2563eb" },
  termine: { label: "Terminé", color: "#16a34a" },
  annule: { label: "Annulé", color: "#dc2626" },
  absent: { label: "Absent", color: "#d97706" },
};

export const STATUTS_FACTURE: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#d97706" },
  partielle: { label: "Partielle", color: "#2563eb" },
  payee: { label: "Payée", color: "#16a34a" },
  annulee: { label: "Annulée", color: "#dc2626" },
};

export const SPECIALITES = [
  "Médecine générale",
  "Pédiatrie",
  "Gynécologie-Obstétrique",
  "Cardiologie",
  "Dermatologie",
  "ORL",
  "Ophtalmologie",
  "Médecine dentaire",
  "Rhumatologie",
  "Gastro-entérologie",
  "Endocrinologie",
  "Neurologie",
  "Psychiatrie",
  "Urologie",
];

export function formatMAD(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function age(dateNaissance: string | null | undefined): string {
  if (!dateNaissance) return "-";
  const birth = new Date(dateNaissance);
  if (Number.isNaN(birth.getTime())) return "-";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return `${years} ans`;
}
