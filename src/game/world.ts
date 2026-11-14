// Pure rules: house layout + collision. No React/three imports.
export type Box = { x1: number; z1: number; x2: number; z2: number };
export const SPEED = 3.2;
export const RADIUS = 0.3;
export const EYE = 1.6;

// House spans x -4..4, z -11..-5. Door in front wall (z=-5), window on left wall (x=-4).
export const HOUSE = { x1: -4, x2: 4, z1: -11, z2: -5, h: 3, t: 0.2 };
export const DOOR = { x1: -0.6, x2: 0.6, h: 2.2 };
export const WINDOW = { z1: -9, z2: -7, y1: 1, y2: 2.1 };

const t = HOUSE.t;
export const walls: Box[] = [
  { x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z1 + t }, // back
  { x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x1 + t, z2: HOUSE.z2 }, // left
  { x1: HOUSE.x2 - t, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2 }, // right
  { x1: HOUSE.x1, z1: HOUSE.z2 - t, x2: DOOR.x1, z2: HOUSE.z2 }, // front-left
  { x1: DOOR.x2, z1: HOUSE.z2 - t, x2: HOUSE.x2, z2: HOUSE.z2 }, // front-right
];
export const furniture: Box[] = [
  { x1: -3.7, z1: -6.6, x2: -1.7, z2: -5.8 }, // sofa
  { x1: -3.2, z1: -8.9, x2: -1.6, z2: -8.1 }, // dining table
  { x1: 0.6, z1: -10.8, x2: 3.8, z2: -10.2 }, // kitchen counter
  { x1: 3.2, z1: -10.2, x2: 3.8, z2: -8.6 }, // fridge + side counter
  { x1: 2.4, z1: -6.2, x2: 3.8, z2: -5.3 }, // bookshelf/cabinet
];
const solids = [...walls, ...furniture];

function hits(x: number, z: number) {
  return solids.some((b) => x + RADIUS > b.x1 && x - RADIUS < b.x2 && z + RADIUS > b.z1 && z - RADIUS < b.z2);
}

/** Moves with per-axis sliding against walls. */
export function move(x: number, z: number, dx: number, dz: number) {
  const nx = hits(x + dx, z) ? x : x + dx;
  const nz = hits(nx, z + dz) ? z : z + dz;
  const L = 40;
  return { x: Math.max(-L, Math.min(L, nx)), z: Math.max(-L, Math.min(L, nz)) };
}
