import { expect, it } from "vitest";
import { chasePosition } from "./camera";

it("puts third-person camera behind the player, not in front", () => {
  expect(chasePosition({ x: 0, y: 0, z: 6, vy: 0 }, { x: 0, y: 0, z: -1 }).z).toBe(9.8);
  expect(chasePosition({ x: 0, y: 0, z: 6, vy: 0 }, { x: 1, y: 0, z: 0 }).x).toBe(-3.8);
});
it("keeps camera relative to jumping and underground players", () => {
  const forward = { x: 0, y: -0.2, z: -0.98 };
  const ground = chasePosition({ x: 0, y: 0, z: 0, vy: 0 }, forward);
  expect(chasePosition({ x: 0, y: 2, z: 0, vy: 0 }, forward).y - ground.y).toBeCloseTo(2);
  expect(chasePosition({ x: 0, y: -4, z: 0, vy: 0 }, forward).y - ground.y).toBeCloseTo(-4);
});
it("can shorten the camera arm when a wall is behind the player", () => {
  expect(chasePosition({ x: 0, y: 0, z: 0, vy: 0 }, { x: 0, y: 0, z: -1 }, 0.5).z).toBe(0.5);
});