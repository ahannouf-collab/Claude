// Banque de noms 100% fictifs (aucun joueur, club ou compétition réel) —
// générés par combinaison de syllabes pour éviter toute ressemblance avec
// des personnes existantes tout en gardant une sonorité internationale.

const FIRST_SYLLABLES = [
  "Ka", "Ri", "Mo", "Da", "Lu", "Fe", "To", "Bra", "Nil", "So",
  "Ma", "Vi", "En", "Ol", "Ye", "Iz", "Ar", "Cle", "Dom", "Ju",
  "Ro", "Sa", "Wil", "Kel", "Adri", "Ben", "Cor", "Div", "Emi", "Fabi",
];
const FIRST_ENDINGS = [
  "n", "ko", "ric", "el", "son", "an", "ito", "as", "im", "ov",
  "ny", "us", "ol", "ez", "eu", "ino", "sen", "dor", "vic", "ago",
];

const LAST_SYLLABLES = [
  "San", "Mar", "Kov", "Fer", "Bel", "Dun", "Ros", "Van", "Kar", "Sil",
  "Bar", "Mon", "Dias", "Ecc", "Reb", "Tor", "Wal", "Zan", "Pel", "Nor",
];
const LAST_ENDINGS = [
  "tos", "sky", "reira", "ino", "berg", "dez", "ussi", "ton", "eiro", "ac",
  "witz", "elli", "ard", "man", "ov", "eanu", "asu", "combe", "field", "ez",
];

export function randomFirstName(rng: () => number): string {
  return (
    pick(FIRST_SYLLABLES, rng) + pick(FIRST_ENDINGS, rng)
  );
}

export function randomLastName(rng: () => number): string {
  return pick(LAST_SYLLABLES, rng) + pick(LAST_ENDINGS, rng);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Noms de clubs fictifs (villes/adjectifs inventés) pour la ligue.
export const CLUB_NAME_POOL = [
  "Portavia FC", "Norlan United", "Estrella Rovers", "Kaldenberg SC",
  "Rioverde Athletic", "Nortport City", "Vallenza Calcio", "Brannfjord IF",
  "Costa Marino", "Ardenwall United", "Solheim FK", "Terracin SC",
  "Belmorra United", "Kingsford Rangers", "Alto Vitoria", "Nuevo Leon SC",
  "Drakenveld FC", "Sanremora AC", "Whitebridge Town", "Ferralta United",
];

export const KIT_COLORS = [
  "#1d4ed8", "#dc2626", "#059669", "#7c3aed", "#ea580c",
  "#0891b2", "#be185d", "#65a30d", "#1e293b", "#facc15",
];
