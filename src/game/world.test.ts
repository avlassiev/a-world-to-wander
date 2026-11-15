import { describe, expect, it } from "vitest";
import { HOLE_START_D, HOLE_MAX_D, step, attractTrees, treePose, fillHole, digHole, digTunnel, tunnelFurnishings, recoverTrees, TREE_FALL_SECONDS, type FallingTree, type Body } from "./world";

const hole = [{ x: 0, z: 10, r: 1, d: HOLE_START_D }];
const run = (b: Body, n: number, jump = false, dx = 0, dz = 0) => {
  for (let i = 0; i < n; i++) b = step(b, dx, dz, jump && i === 0, hole, 1 / 60);
  return b;
};

describe("tunnels and recovering trees", () => {
  const pit = { x: 0, z: 15, r: 1.2, d: 3.2, id: 1 };
  it("places a table and kitchen in the first dug passage, not every extension", () => {
    const tunnels = [{ x: 1.2, z: 15, floor: -3.2, shaft: 1 }, { x: 2.4, z: 15, floor: -3.2, shaft: 1 }];
    const rooms = tunnelFurnishings(tunnels);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.table.z1).toBe(13);
    expect(rooms[0]?.kitchen.z1).toBe(16.65);
    expect(rooms[0]?.chairs).toHaveLength(2);
    expect(rooms[0]?.toilet.z2).toBe(17.2);
    expect(tunnelFurnishings([])).toEqual([]);
  });
  it("keeps the centre walkable and blocks walking through the table and kitchen", () => {
    const tunnels = [{ x: 0, z: 15, floor: -3.2, shaft: 1, room: true }];
    const start = { x: 0, y: -3.2, z: 15, vy: 0 };
    expect(step(start, 0, 0.1, false, [], 1 / 60, tunnels).z).toBe(15.1);
    expect(step({ ...start, x: -1.3, z: 13.9 }, 0, -0.1, false, [], 1 / 60, tunnels).z).toBe(13.9);
    expect(step({ ...start, z: 16.3 }, 0, 0.2, false, [], 1 / 60, tunnels).z).toBe(16.3);
  });
  it("filling the entrance preserves the room, furniture and player inside it", () => {
    const tunnels = digTunnel([pit], [], { x: 0, y: -3.2, z: 15, vy: 0 }, 1, 0);
    const player = { x: 2.8, y: -3.2, z: 15, vy: 0 };
    const filled = fillHole([pit], [], 0, 15, player);
    expect(tunnelFurnishings(tunnels)).toHaveLength(1);
    expect(step(filled.player ?? player, 0, 0, false, filled.holes, 1 / 60, tunnels)).toMatchObject({ y: -3.2 });
    expect(filled.player?.buried).toBeUndefined();
  });
  it("can dig and walk along an underground passage without exposing the surface", () => {
    const start = { x: 0, y: -3.2, z: 15, vy: 0 };
    const tunnels = digTunnel([pit], [], start, 1, 0);
    expect(tunnels).toHaveLength(1);
    let b = start;
    for (let i = 0; i < 30; i++) b = step(b, 0.05, 0, false, [pit], 1 / 60, tunnels);
    expect(b.x).toBeCloseTo(1.5);
    expect(b.y).toBe(-3.2);
    const next = digTunnel([pit], tunnels, { ...b, x: 3 }, 1, 0);
    expect(next).toHaveLength(2);
    expect(step({ ...b, y: 0 }, 0, 0, false, [pit], 1 / 60, next).y).toBe(0);
  });
  it("solid earth blocks movement past the tunnel end", () => {
    const tunnels = digTunnel([pit], [], { x: 0, y: -3.2, z: 15, vy: 0 }, 1, 0);
    let b = { x: 0, y: -3.2, z: 15, vy: 0 };
    for (let i = 0; i < 100; i++) b = step(b, 0.05, 0, false, [pit], 1 / 60, tunnels);
    expect(b.x).toBeLessThan(3.6);
    expect(b.y).toBe(-3.2);
  });
  it("returns through the tunnel to the shaft and jumps out", () => {
    const tunnels = digTunnel([pit], [], { x: 0, y: -3.2, z: 15, vy: 0 }, 1, 0);
    let b = { x: 1.5, y: -3.2, z: 15, vy: 0 };
    for (let i = 0; i < 30; i++) b = step(b, -0.05, 0, false, [pit], 1 / 60, tunnels);
    let peak = b.y;
    for (let i = 0; i < 90; i++) { b = step(b, 0, 0, i === 0, [pit], 1 / 60, tunnels); peak = Math.max(peak, b.y); }
    expect(peak).toBeGreaterThan(0);
  });
  it("reopens a filled pit and uncovers the same tree at its burial depth", () => {
    const tree: FallingTree = { x: 0, z: 15, s: 1, birth: -100, fall: { hole: pit, started: 0 } };
    const filled = fillHole([pit], [tree], 0, 15);
    let holes = digHole(filled.holes, 0, 15, 2);
    recoverTrees(filled.trees, holes[0] ?? pit, 10);
    expect(filled.trees[0]?.buried).toBe(true);
    for (let i = 0; i < 4; i++) holes = digHole(holes, 0, 15, 3);
    recoverTrees(filled.trees, holes[0] ?? pit, 10);
    expect(filled.trees[0]?.buried).toBe(false);
    expect(filled.trees[0]?.fall?.hole.id).toBe(2);
    expect(treePose(filled.trees[0] ?? tree, 10).y).toBeCloseTo(-3.2);
    expect(fillHole(holes, filled.trees, 0, 15).trees[0]?.buried).toBe(true);
  });
});

describe("deep holes", () => {
  it("player standing over a hole falls to its bottom", () => {
    expect(run({ x: 0, y: 0, z: 10, vy: 0 }, 120).y).toBeCloseTo(-HOLE_START_D);
  });
  it("hole walls block walking out from the bottom", () => {
    const b = run({ x: 0, y: -HOLE_START_D, z: 10, vy: 0 }, 120, false, 0.05, 0);
    expect(b.x).toBeLessThan(1);
    expect(b.y).toBeCloseTo(-HOLE_START_D);
  });
  it("jumping from the bottom gets above the rim", () => {
    let b: Body = { x: 0, y: -HOLE_START_D, z: 10, vy: 0 };
    let maxY = -Infinity;
    b = step(b, 0, 0, true, hole, 1 / 60);
    for (let i = 0; i < 60; i++) { b = step(b, 0, 0, false, hole, 1 / 60); maxY = Math.max(maxY, b.y); }
    expect(maxY).toBeGreaterThan(0);
  });
  it("you can jump out of the deepest possible hole too", () => {
    const deep = [{ x: 0, z: 10, r: 1, d: HOLE_MAX_D }];
    let b: Body = { x: 0, y: -HOLE_MAX_D, z: 10, vy: 0 };
    let maxY = -Infinity;
    b = step(b, 0, 0, true, deep, 1 / 60);
    for (let i = 0; i < 90; i++) { b = step(b, 0, 0, false, deep, 1 / 60); maxY = Math.max(maxY, b.y); }
    expect(maxY).toBeGreaterThan(0);
  });
  it("away from holes you stand on the ground", () => {
    expect(run({ x: 20, y: 1, z: 20, vy: 0 }, 120).y).toBe(0);
  });
});

describe("trees falling into dug holes", () => {
  const makeTree = (x: number, z = 10): FallingTree => ({ x, z, s: 1, birth: -100 });
  const pit = { x: 0, z: 10, r: 0.6, d: 1.2, id: 1 };
  it("a tree above the hole falls to the bottom", () => {
    const tr = makeTree(0);
    attractTrees([tr], pit, 0, true);
    expect(treePose(tr, TREE_FALL_SECONDS)).toMatchObject({ x: 0, y: -1.2, z: 10 });
  });
  it("a nearby tree falls in even when its roots are outside the hole", () => {
    const tr = makeTree(2);
    attractTrees([tr], pit, 0, true);
    const halfway = treePose(tr, TREE_FALL_SECONDS / 2);
    expect(halfway.x).toBeLessThan(2);
    expect(halfway.y).toBeLessThan(0);
    expect(halfway.tilt).toBeGreaterThan(0);
    expect(treePose(tr, TREE_FALL_SECONDS)).toMatchObject({ x: 0, y: -1.2, z: 10 });
  });
  it("digging away from trees attracts the nearest tree, not the whole forest", () => {
    const trees = [makeTree(10), makeTree(20)];
    attractTrees(trees, pit, 0, true);
    expect(trees[0]?.fall?.hole.id).toBe(1);
    expect(trees[1]?.fall).toBeUndefined();
  });
  it("deepening the hole lowers the tree instead of making another distant tree fall", () => {
    const trees = [makeTree(0), makeTree(20)];
    attractTrees(trees, pit, 0, true);
    attractTrees(trees, { ...pit, d: 6 }, 3, false);
    expect(treePose(trees[0] ?? makeTree(0), 4).y).toBe(-6);
    expect(trees[1]?.fall).toBeUndefined();
  });
});

describe("filling holes", () => {
  const pit = { x: 0, z: 10, r: 0.6, d: 6, id: 1 };
  it("fills the targeted hole completely without removing other holes", () => {
    const other = { ...pit, x: 10, id: 2 };
    expect(fillHole([pit, other], [], 0, 10).holes).toEqual([other]);
  });
  it("buries a fallen tree and leaves other trees alone", () => {
    const tr: FallingTree = { x: 0, z: 10, s: 1, birth: -100 };
    const other: FallingTree = { x: 20, z: 10, s: 1, birth: -100 };
    attractTrees([tr, other], pit, 0, true);
    const result = fillHole([pit], [tr, other], 0, 10);
    expect(result.holes).toHaveLength(0);
    expect(result.trees[0]?.buried).toBe(true);
    expect(result.trees[1]?.buried).toBeUndefined();
    expect(tr.buried).toBeUndefined();
  });
  it("filling while inside buries the player instead of lifting them out", () => {
    const result = fillHole([pit], [], 0, 10, { x: 0, y: -6, z: 10, vy: 0 });
    if (!result.player) throw new Error("Missing player");
    const b = step(result.player, 1, 0, false, result.holes, 1 / 60);
    expect(b.y).toBe(-6);
    expect(b.x).toBe(0);
    expect(b.buried?.d).toBe(6);
  });
  it("Space lets a buried player jump above the surface", () => {
    const result = fillHole([pit], [], 0, 10, { x: 0, y: -6, z: 10, vy: 0 });
    if (!result.player) throw new Error("Missing player");
    let b = step(result.player, 0, 0, true, [], 1 / 60);
    let peak = b.y;
    for (let i = 0; i < 120; i++) { b = step(b, 0, 0, false, [], 1 / 60); peak = Math.max(peak, b.y); }
    expect(peak).toBeGreaterThan(0);
    expect(b.y).toBe(0);
    expect(b.buried).toBeUndefined();
  });
  it("filling after jumping out does not bury the player", () => {
    const result = fillHole([pit], [], 0, 10, { x: 0, y: 0.3, z: 10, vy: 2 });
    expect(result.player?.buried).toBeUndefined();
    expect(result.player?.y).toBe(0.3);
  });
  it("does nothing when there is no hole within reach", () => {
    expect(fillHole([pit], [], 20, 20).holes).toEqual([pit]);
  });
});
