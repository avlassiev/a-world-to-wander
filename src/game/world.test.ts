import { describe, expect, it } from "vitest";
import { HOLE_DEPTH, step, type Body } from "./world";

const hole = [{ x: 0, z: 10, r: 1 }];
const run = (b: Body, n: number, jump = false, dx = 0, dz = 0) => {
  for (let i = 0; i < n; i++) b = step(b, dx, dz, jump && i === 0, hole, 1 / 60);
  return b;
};

describe("deep holes", () => {
  it("player standing over a hole falls to its bottom", () => {
    expect(run({ x: 0, y: 0, z: 10, vy: 0 }, 120).y).toBeCloseTo(-HOLE_DEPTH);
  });
  it("hole walls block walking out from the bottom", () => {
    const b = run({ x: 0, y: -HOLE_DEPTH, z: 10, vy: 0 }, 120, false, 0.05, 0);
    expect(b.x).toBeLessThan(1);
    expect(b.y).toBeCloseTo(-HOLE_DEPTH);
  });
  it("jumping from the bottom gets above the rim", () => {
    let b: Body = { x: 0, y: -HOLE_DEPTH, z: 10, vy: 0 };
    let maxY = -Infinity;
    b = step(b, 0, 0, true, hole, 1 / 60);
    for (let i = 0; i < 60; i++) { b = step(b, 0, 0, false, hole, 1 / 60); maxY = Math.max(maxY, b.y); }
    expect(maxY).toBeGreaterThan(0);
  });
  it("away from holes you stand on the ground", () => {
    expect(run({ x: 20, y: 1, z: 20, vy: 0 }, 120).y).toBe(0);
  });
});
