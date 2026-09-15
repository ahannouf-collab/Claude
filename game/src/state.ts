import { generateSquad, generatePlayer, grantXP, overallOf, type Player, type Position } from "./data/players";
import { generateLeagueOpponents, autoPickStartingXI, type Formation, type OpponentClub } from "./data/clubs";
import { KIT_COLORS } from "./data/names";

export interface ClubIdentity {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  formation: Formation;
  startingXI: string[];
}

export interface Fixture {
  matchday: number;
  opponent: string;
  opponentStrength: number;
  played: boolean;
  scoreUser?: number;
  scoreOpp?: number;
}

export interface LeagueRow {
  name: string;
  isUser: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface GameState {
  version: 1;
  club: ClubIdentity;
  squad: Player[];
  currency: number;
  season: number;
  nextMatchday: number; // index dans fixtures
  fixtures: Fixture[];
  leagueTable: LeagueRow[];
  log: string[];
}

const SAVE_KEY = "fcclash_save_v1";

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible (mode privé…) : on continue sans persister
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* noop */
  }
}

function buildFixtures(opponents: OpponentClub[]): Fixture[] {
  return opponents.map((o, i) => ({
    matchday: i + 1,
    opponent: o.name,
    opponentStrength: o.strength,
    played: false,
  }));
}

function buildLeagueTable(userName: string, opponents: OpponentClub[]): LeagueRow[] {
  const rows: LeagueRow[] = opponents.map((o) => ({
    name: o.name,
    isUser: false,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }));
  rows.unshift({ name: userName, isUser: true, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
  return rows;
}

export function createNewGame(
  clubName: string,
  primaryColor: string,
  secondaryColor: string,
  formation: Formation,
  seed?: number
): GameState {
  const rng = (() => {
    let s = seed ?? Date.now() ^ Math.floor(Math.random() * 1e9);
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const squad = generateSquad(rng, 18);
  const startingXI = autoPickStartingXI(squad, formation);
  const opponents = generateLeagueOpponents(rng, 19);
  return {
    version: 1,
    club: { name: clubName, primaryColor, secondaryColor, formation, startingXI },
    squad,
    currency: 500,
    season: 1,
    nextMatchday: 0,
    fixtures: buildFixtures(opponents),
    leagueTable: buildLeagueTable(clubName, opponents),
    log: [`Bienvenue à la tête du ${clubName} ! Saison 1 lancée.`],
  };
}

export function currentFixture(state: GameState): Fixture | null {
  return state.fixtures[state.nextMatchday] ?? null;
}

function updateRow(row: LeagueRow, gf: number, ga: number): LeagueRow {
  const won = gf > ga ? 1 : 0;
  const drawn = gf === ga ? 1 : 0;
  const lost = gf < ga ? 1 : 0;
  return {
    ...row,
    played: row.played + 1,
    won: row.won + won,
    drawn: row.drawn + drawn,
    lost: row.lost + lost,
    gf: row.gf + gf,
    ga: row.ga + ga,
    points: row.points + won * 3 + drawn,
  };
}

export interface MatchRewards {
  currency: number;
  xpPerStarter: number;
  outcome: "Victoire" | "Nul" | "Défaite";
}

export function recordMatchResult(state: GameState, scoreUser: number, scoreOpp: number): { state: GameState; rewards: MatchRewards } {
  const fixture = currentFixture(state);
  if (!fixture) throw new Error("Aucun match à enregistrer");

  const outcome: MatchRewards["outcome"] = scoreUser > scoreOpp ? "Victoire" : scoreUser === scoreOpp ? "Nul" : "Défaite";
  const currencyReward = outcome === "Victoire" ? 180 : outcome === "Nul" ? 90 : 45;
  const xpPerStarter = outcome === "Victoire" ? 45 : outcome === "Nul" ? 28 : 16;

  const fixtures = state.fixtures.map((f) =>
    f.matchday === fixture.matchday ? { ...f, played: true, scoreUser, scoreOpp } : f
  );

  const leagueTable = state.leagueTable.map((row) => {
    if (row.isUser) return updateRow(row, scoreUser, scoreOpp);
    if (row.name === fixture.opponent) return updateRow(row, scoreOpp, scoreUser);
    return row;
  });
  leagueTable.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));

  const squad = state.squad.map((p) =>
    state.club.startingXI.includes(p.id) ? grantXP(p, xpPerStarter) : p
  );

  const nextMatchday = state.nextMatchday + 1;
  const seasonComplete = nextMatchday >= state.fixtures.length;

  let newState: GameState = {
    ...state,
    squad,
    currency: state.currency + currencyReward,
    fixtures,
    leagueTable,
    nextMatchday,
    log: [`J${fixture.matchday} : ${outcome} ${scoreUser}-${scoreOpp} vs ${fixture.opponent} (+${currencyReward} pièces)`, ...state.log].slice(0, 30),
  };

  if (seasonComplete) {
    newState = startNewSeason(newState);
  }

  return { state: newState, rewards: { currency: currencyReward, xpPerStarter, outcome } };
}

function startNewSeason(state: GameState): GameState {
  const rng = () => Math.random();
  const opponents = generateLeagueOpponents(rng, 19);
  return {
    ...state,
    season: state.season + 1,
    nextMatchday: 0,
    fixtures: buildFixtures(opponents),
    leagueTable: buildLeagueTable(state.club.name, opponents),
    log: [`🏁 Fin de saison ${state.season} ! Saison ${state.season + 1} lancée.`, ...state.log].slice(0, 30),
  };
}

export interface PackDefinition {
  id: "bronze" | "or" | "elite";
  label: string;
  cost: number;
  size: number;
  minOverallHint: string;
}

export const PACKS: PackDefinition[] = [
  { id: "bronze", label: "Pack Bronze", cost: 300, size: 3, minOverallHint: "Bronze → Or" },
  { id: "or", label: "Pack Or", cost: 900, size: 3, minOverallHint: "Argent → Élite" },
  { id: "elite", label: "Pack Élite", cost: 2200, size: 2, minOverallHint: "Or → Légende" },
];

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

export function openPack(state: GameState, packId: PackDefinition["id"]): { state: GameState; players: Player[] } {
  const def = PACKS.find((p) => p.id === packId);
  if (!def) throw new Error("Pack inconnu");
  if (state.currency < def.cost) throw new Error("Pièces insuffisantes");

  const rng = () => Math.random();
  const boost = packId === "elite" ? 0.35 : packId === "or" ? 0.18 : 0;
  const players: Player[] = [];
  for (let i = 0; i < def.size; i++) {
    const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
    const biasedRng = () => Math.min(0.999, rng() + boost * rng());
    players.push(generatePlayer(position, biasedRng));
  }

  return {
    state: {
      ...state,
      currency: state.currency - def.cost,
      squad: [...state.squad, ...players],
      log: [`🎁 ${def.label} ouvert : ${players.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}`, ...state.log].slice(0, 30),
    },
    players,
  };
}

export function releasePlayer(state: GameState, playerId: string): GameState {
  const player = state.squad.find((p) => p.id === playerId);
  if (!player) return state;
  const refund = Math.round(overallOf(player) * 4);
  return {
    ...state,
    squad: state.squad.filter((p) => p.id !== playerId),
    club: { ...state.club, startingXI: state.club.startingXI.filter((id) => id !== playerId) },
    currency: state.currency + refund,
    log: [`↩️ ${player.firstName} ${player.lastName} libéré (+${refund} pièces)`, ...state.log].slice(0, 30),
  };
}

export function setStartingXI(state: GameState, ids: string[]): GameState {
  return { ...state, club: { ...state.club, startingXI: ids } };
}

export function setFormation(state: GameState, formation: Formation): GameState {
  const startingXI = autoPickStartingXI(state.squad, formation);
  return { ...state, club: { ...state.club, formation, startingXI } };
}

export function setClubColors(state: GameState, primaryColor: string, secondaryColor: string): GameState {
  return { ...state, club: { ...state.club, primaryColor, secondaryColor } };
}

export function setClubName(state: GameState, name: string): GameState {
  return { ...state, club: { ...state.club, name } };
}

export { KIT_COLORS };
