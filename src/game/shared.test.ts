import { describe, expect, it } from "vitest";
import { applyWorldEdit, sharedSave, type WorldEdit } from "./shared";
import { snapshot } from "./save";
import { createTrees, tunnelFurnishings } from "./world";
const player = { x: 0, y: 0, z: 6, vy: 0 };
const edit = (x: number, id: number): WorldEdit => ({ kind: "dig", x, z: 50, id, time: 10, player });
describe("common forest", () => {
  it("keeps both computers' digs when a conflicting edit is replayed", () => {
    const base = snapshot([], [], createTrees(), player, 0);
    const first = applyWorldEdit(base, edit(50, 1));
    const second = applyWorldEdit(first, edit(60, 2));
    expect(second.holes.map((h) => h.id)).toEqual([1, 2]);
  });
  it("shares rooms and furniture without moving the other player", () => {
    const base = snapshot([], [{ x: 0, z: 16.2, floor: -3.2, shaft: 123, room: true }], createTrees(), { ...player, x: 90 }, 50);
    const loaded = sharedSave(base, player);
    expect(loaded?.player.x).toBe(0);
    expect(loaded?.tunnels).toEqual(base.tunnels);
    expect(tunnelFurnishings(loaded?.tunnels ?? [])).toHaveLength(1);
  });
});