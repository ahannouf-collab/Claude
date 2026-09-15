import { randomFirstName, randomLastName } from "./names";

export type Position = "GK" | "DF" | "MF" | "FW";
export type Rarity = "Bronze" | "Argent" | "Or" | "Élite" | "Légende";

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  rarity: Rarity;
  age: number;
  level: number;
  xp: number;
  xpToNext: number;
  base: { pace: number; shooting: number; passing: number; defending: number; physical: number };
}

export const RARITY_ORDER: Rarity[] = ["Bronze", "Argent", "Or", "Élite", "Légende"];

const RARITY_RANGE: Record<Rarity, [number, number]> = {
  Bronze: [40, 58],
  Argent: [55, 70],
  Or: [68, 80],
  Élite: [78, 88],
  Légende: [86, 95],
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter}`;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed?: number): () => number {
  return mulberry32(seed ?? Date.now() ^ Math.floor(Math.random() * 1e9));
}

function statFor(position: Position, rng: () => number, [lo, hi]: [number, number]) {
  const roll = () => lo + Math.floor(rng() * (hi - lo + 1));
  const base = { pace: roll(), shooting: roll(), passing: roll(), defending: roll(), physical: roll() };
  // Ajuste selon le poste pour des profils cohérents.
  if (position === "GK") {
    base.defending = Math.min(99, base.defending + 10);
    base.shooting = Math.max(20, base.shooting - 20);
  } else if (position === "DF") {
    base.defending = Math.min(99, base.defending + 8);
    base.shooting = Math.max(25, base.shooting - 8);
  } else if (position === "FW") {
    base.shooting = Math.min(99, base.shooting + 8);
    base.defending = Math.max(20, base.defending - 10);
  }
  return base;
}

export function overallOf(p: Player): number {
  const { pace, shooting, passing, defending, physical } = p.base;
  const weighted =
    p.position === "GK"
      ? defending * 0.55 + physical * 0.25 + passing * 0.2
      : p.position === "DF"
      ? defending * 0.45 + physical * 0.25 + pace * 0.15 + passing * 0.15
      : p.position === "MF"
      ? passing * 0.4 + defending * 0.2 + pace * 0.2 + shooting * 0.2
      : shooting * 0.45 + pace * 0.3 + passing * 0.15 + physical * 0.1;
  const levelBonus = (p.level - 1) * 0.6;
  return Math.round(Math.min(99, weighted + levelBonus));
}

export function rarityFor(overall: number): Rarity {
  if (overall >= 86) return "Légende";
  if (overall >= 78) return "Élite";
  if (overall >= 68) return "Or";
  if (overall >= 55) return "Argent";
  return "Bronze";
}

export function generatePlayer(position: Position, rng: () => number, forcedRarity?: Rarity): Player {
  const rarity = forcedRarity ?? weightedRarity(rng);
  const base = statFor(position, rng, RARITY_RANGE[rarity]);
  const player: Player = {
    id: nextId(),
    firstName: randomFirstName(rng),
    lastName: randomLastName(rng),
    position,
    rarity,
    age: 17 + Math.floor(rng() * 18),
    level: 1,
    xp: 0,
    xpToNext: 100,
    base,
  };
  return player;
}

function weightedRarity(rng: () => number): Rarity {
  const roll = rng();
  if (roll < 0.55) return "Bronze";
  if (roll < 0.82) return "Argent";
  if (roll < 0.95) return "Or";
  if (roll < 0.995) return "Élite";
  return "Légende";
}

export function generateSquad(rng: () => number, size = 18): Player[] {
  const layout: Position[] = ["GK", "GK", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "DF", "MF", "FW"];
  const squad: Player[] = [];
  for (let i = 0; i < size; i++) {
    squad.push(generatePlayer(layout[i % layout.length], rng));
  }
  return squad;
}

export function grantXP(player: Player, amount: number): Player {
  let xp = player.xp + amount;
  let level = player.level;
  let xpToNext = player.xpToNext;
  while (xp >= xpToNext && level < 30) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.18);
  }
  return { ...player, xp, level, xpToNext };
}

export function fullName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}
