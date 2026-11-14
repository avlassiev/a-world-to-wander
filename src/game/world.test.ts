import { describe, expect, it } from "vitest";
import { HOLE_START_D, HOLE_MAX_D, step, attractTrees, treePose, TREE_FALL_SECONDS, type FallingTree, type Body } from "./world";

const hole = [{ x: 0, z: 10, r: 1, d: HOLE_START_D }];
const run = (b: Body, n: number, jump = false, dx = 0, dz = 0) => {
  for (let i = 0; i < n; i++) b = step(b, dx, dz, jump && i === 0, hole, 1 / 60);
  return b;
};

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
