import type { Formation } from "./clubs";
import type { Position } from "./players";

export interface SlotLayout {
  x: number; // fraction du terrain, 0 = ligne de but propre, 1 = ligne de but adverse
  y: number; // fraction de la hauteur, 0..1
  role: Position;
}

// Dispositions pour une équipe attaquant vers la droite (x croissant).
// L'équipe adverse est simplement symétrisée (x' = 1 - x) au moment du placement.
export const FORMATION_LAYOUT: Record<Formation, SlotLayout[]> = {
  "4-4-2": [
    { x: 0.06, y: 0.5, role: "GK" },
    { x: 0.2, y: 0.16, role: "DF" },
    { x: 0.2, y: 0.38, role: "DF" },
    { x: 0.2, y: 0.62, role: "DF" },
    { x: 0.2, y: 0.84, role: "DF" },
    { x: 0.4, y: 0.16, role: "MF" },
    { x: 0.4, y: 0.38, role: "MF" },
    { x: 0.4, y: 0.62, role: "MF" },
    { x: 0.4, y: 0.84, role: "MF" },
    { x: 0.55, y: 0.38, role: "FW" },
    { x: 0.55, y: 0.62, role: "FW" },
  ],
  "4-3-3": [
    { x: 0.06, y: 0.5, role: "GK" },
    { x: 0.2, y: 0.16, role: "DF" },
    { x: 0.2, y: 0.38, role: "DF" },
    { x: 0.2, y: 0.62, role: "DF" },
    { x: 0.2, y: 0.84, role: "DF" },
    { x: 0.4, y: 0.25, role: "MF" },
    { x: 0.4, y: 0.5, role: "MF" },
    { x: 0.4, y: 0.75, role: "MF" },
    { x: 0.56, y: 0.18, role: "FW" },
    { x: 0.56, y: 0.5, role: "FW" },
    { x: 0.56, y: 0.82, role: "FW" },
  ],
  "3-5-2": [
    { x: 0.06, y: 0.5, role: "GK" },
    { x: 0.18, y: 0.25, role: "DF" },
    { x: 0.18, y: 0.5, role: "DF" },
    { x: 0.18, y: 0.75, role: "DF" },
    { x: 0.4, y: 0.1, role: "MF" },
    { x: 0.4, y: 0.3, role: "MF" },
    { x: 0.4, y: 0.5, role: "MF" },
    { x: 0.4, y: 0.7, role: "MF" },
    { x: 0.4, y: 0.9, role: "MF" },
    { x: 0.55, y: 0.38, role: "FW" },
    { x: 0.55, y: 0.62, role: "FW" },
  ],
};
