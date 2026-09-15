import { CLUB_NAME_POOL, KIT_COLORS } from "./names";
import { generateSquad, overallOf, type Player, makeRng } from "./players";

export type Formation = "4-4-2" | "4-3-3" | "3-5-2";

export const FORMATIONS: Record<Formation, string[]> = {
  "4-4-2": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW"],
  "4-3-3": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"],
  "3-5-2": ["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW"],
};

export interface OpponentClub {
  name: string;
  strength: number; // moyenne d'équipe 1-99
  primaryColor: string;
}

export function generateLeagueOpponents(rng: () => number, count = 19): OpponentClub[] {
  const shuffled = [...CLUB_NAME_POOL].sort(() => rng() - 0.5).slice(0, count);
  return shuffled.map((name, i) => ({
    name,
    strength: 55 + Math.floor(rng() * 30),
    primaryColor: KIT_COLORS[i % KIT_COLORS.length],
  }));
}

export function squadOverall(squad: Player[], ids: string[]): number {
  const chosen = squad.filter((p) => ids.includes(p.id));
  if (chosen.length === 0) return 50;
  return Math.round(chosen.reduce((sum, p) => sum + overallOf(p), 0) / chosen.length);
}

export function autoPickStartingXI(squad: Player[], formation: Formation): string[] {
  const need = [...FORMATIONS[formation]];
  const pool = [...squad].sort((a, b) => overallOf(b) - overallOf(a));
  const chosen: string[] = [];
  for (const pos of need) {
    const idx = pool.findIndex((p) => p.position === pos && !chosen.includes(p.id));
    if (idx >= 0) {
      chosen.push(pool[idx].id);
    } else {
      const fallback = pool.find((p) => !chosen.includes(p.id));
      if (fallback) chosen.push(fallback.id);
    }
  }
  return chosen;
}

export { makeRng, generateSquad };
