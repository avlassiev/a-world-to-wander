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
  if (inPond(x, z, RADIUS)) return true;
  return solids.some((b) => x + RADIUS > b.x1 && x - RADIUS < b.x2 && z + RADIUS > b.z1 && z - RADIUS < b.z2);
}

/** Moves with per-axis sliding against walls. */
export function move(x: number, z: number, dx: number, dz: number) {
  const nx = hits(x + dx, z) ? x : x + dx;
  const nz = hits(nx, z + dz) ? z : z + dz;
  const L = 40;
  return { x: Math.max(-L, Math.min(L, nx)), z: Math.max(-L, Math.min(L, nz)) };
}

export type Pond = { x: number; z: number; r: number };
export const ponds: Pond[] = [
  { x: -10, z: 2, r: 3 },
  { x: 9, z: -2, r: 2.5 },
  { x: 6, z: 10, r: 2 },
];
export const GROW_SECONDS = 40; // time for a tree to reach full size

/** 0..1 growth of something born at `birth` seconds. */
export function growth(time: number, birth: number, span = GROW_SECONDS) {
  return Math.max(0, Math.min(1, (time - birth) / span));
}

export type FallingTree = {
  x: number; z: number; s: number; birth: number;
  buried?: boolean;
  fall?: { hole: HoleShape & { id: number }; started: number };
};
export const TREE_FALL_SECONDS = 2;
export function createTrees(): FallingTree[] {
  return Array.from({ length: 40 }, (_, i) => {
    const a = i * 2.4, rr = 14 + ((i * 7) % 20);
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, s: 0.8 + ((i * 13) % 6) / 10, birth: i < 20 ? -100 : (i - 20) * 6 };
  });
}

/** New holes pull nearby trees in, or the nearest tree when dug away from the forest. */
export function attractTrees(trees: FallingTree[], hole: HoleShape & { id: number }, time: number, isNew: boolean) {
  const standing = trees.filter((tr) => !tr.buried && !tr.fall && tr.birth <= time);
  const distance = (tr: FallingTree) => Math.hypot(tr.x - hole.x, tr.z - hole.z);
  const nearby = standing.filter((tr) => distance(tr) <= hole.r + (isNew ? 3 : 0.2));
  if (isNew && nearby.length === 0) {
    const nearest = standing.reduce<FallingTree | undefined>((best, tr) => !best || distance(tr) < distance(best) ? tr : best, undefined);
    if (nearest) nearby.push(nearest);
  }
  for (const tr of nearby) tr.fall = { hole, started: time };
  // Keep fallen trees on the bottom when the same hole gets deeper.
  for (const tr of trees) if (tr.fall?.hole.id === hole.id) tr.fall.hole = hole;
}

export function treePose(tr: FallingTree, time: number) {
  const fall = tr.fall;
  if (!fall) return { x: tr.x, y: 0, z: tr.z, tilt: 0, heading: 0 };
  const p = growth(time, fall.started, TREE_FALL_SECONDS);
  const slide = 1 - (1 - p) ** 3;
  const drop = Math.max(0, (p - 0.35) / 0.65) ** 2;
  return {
    x: tr.x + (fall.hole.x - tr.x) * slide,
    z: tr.z + (fall.hole.z - tr.z) * slide,
    y: -fall.hole.d * drop,
    tilt: Math.sin(p * Math.PI) * 0.65,
    heading: Math.atan2(fall.hole.x - tr.x, fall.hole.z - tr.z),
  };
}
export function inPond(x: number, z: number, pad = 0) {
  return ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
}

export const DIG_REACH = 1.6; // metres in front of the player
export const MAX_HOLES = 150;
/** Holes go only on open ground: not inside the house, not in ponds. */
export function canDig(x: number, z: number) {
  const inHouse = x > HOUSE.x1 - 0.3 && x < HOUSE.x2 + 0.3 && z > HOUSE.z1 - 0.3 && z < HOUSE.z2 + 0.3;
  return !inHouse && !inPond(x, z, 0.5) && Math.abs(x) < 40 && Math.abs(z) < 40;
}

// ---- Deep holes & vertical movement ----
export type HoleShape = { x: number; z: number; r: number; d: number };
/** Fill the targeted pit completely, burying any tree that fell into it. */
export function fillHole<H extends HoleShape & { id: number }>(holes: H[], trees: FallingTree[], x: number, z: number, player?: Body) {
  const target = holes
    .filter((h) => Math.hypot(h.x - x, h.z - z) <= h.r + 0.2)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  if (!target) return { holes, trees, player };
  return {
    holes: holes.filter((h) => h.id !== target.id),
    trees: trees.map((tr) => tr.fall?.hole.id === target.id ? { ...tr, buried: true } : tr),
    player: player && player.y < 0 && holeAt([target], player.x, player.z)
      ? { ...player, buried: { ...target } } : player,
  };
}
export const HOLE_START_R = 0.6;
export const HOLE_START_D = 1.2;
export const HOLE_MAX_R = 2.4;
export const HOLE_MAX_D = 6; // deepest a hole can get
export const GRAVITY = 20;
export const JUMP = 5.5; // normal hop
/** Jump from a hole bottom: just enough to clear the rim at any depth. */
export const climbFor = (d: number) => Math.sqrt(2 * GRAVITY * (d + 0.6));
export type Body = { x: number; y: number; z: number; vy: number; buried?: HoleShape };

export function holeAt(holes: HoleShape[], x: number, z: number) {
  return holes.find((h) => h.r > RADIUS && Math.hypot(x - h.x, z - h.z) < h.r - RADIUS * 0.5);
}

/** One physics step: horizontal move (walls of a hole block you while below ground), gravity, jump. */
export function step(b: Body, dx: number, dz: number, jump: boolean, holes: HoleShape[], dt: number): Body {
  let { x, y, z, vy } = b;
  if (b.buried) {
    const bottom = -b.buried.d;
    if (jump && y <= bottom + 0.001 && vy <= 0) vy = climbFor(b.buried.d);
    vy -= GRAVITY * dt;
    y = Math.max(bottom, y + vy * dt);
    if (y <= bottom) vy = 0;
    if (y >= 0) return { x, y, z, vy };
    return { x, y, z, vy, buried: b.buried };
  }
  if (y < -0.05) {
    const h = holes.find((h) => Math.hypot(x - h.x, z - h.z) < h.r + 0.01);
    const fits = (px: number, pz: number) => !h || Math.hypot(px - h.x, pz - h.z) <= h.r - RADIUS * 0.5;
    if (fits(x + dx, z)) x += dx;
    if (fits(x, z + dz)) z += dz;
  } else {
    ({ x, z } = move(x, z, dx, dz));
  }
  const inHole = holeAt(holes, x, z);
  const ground = inHole ? -inHole.d : 0;
  const onGround = y <= ground + 0.001 && vy <= 0;
  if (onGround && jump) vy = inHole ? climbFor(inHole.d) : JUMP;
  vy -= GRAVITY * dt;
  y += vy * dt;
  if (y <= ground) { y = ground; vy = 0; }
  return { x, y, z, vy };
}
