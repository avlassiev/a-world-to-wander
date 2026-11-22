import { describe, expect, it } from "vitest";
import { applyWorldEdit, sharedSave, type WorldEdit } from "./shared";
import { snapshot } from "./save";
import { createTrees, tunnelFurnishings } from "./world";
const player = { x: 0, y: 0, z: 6, vy: 0 };
const edit = (x: number, id: number): WorldEdit => ({ kind: "dig", x, z: 50, id, time: 10, player });
describe("common forest", () => {
  it("makes the 70 already visible distant trees destructible in older 40-tree saves", () => {
    const old = snapshot([], [], createTrees().slice(0, 40), player, 0);
    const upgraded = sharedSave(old, player);
    expect(upgraded?.trees).toHaveLength(110);
    expect(upgraded?.trees[40]).toMatchObject({ x: 55, z: 0, birth: -100 });
    expect(old.trees).toHaveLength(40);
  });
  it("keeps an exploded tree destroyed on another computer and after a conflicting dig", () => {
    const base = snapshot([], [], createTrees(), player, 0);
    const blasted = applyWorldEdit(base, { kind: "blast", x: 0, z: -1, id: 0, time: 10, player });
    const next = applyWorldEdit(blasted, edit(50, 1));
    const loaded = sharedSave(JSON.parse(JSON.stringify(next)), player);
    expect(loaded?.trees[0]?.destroyed).toBe(true);
    expect(loaded?.trees[0]?.explosion?.time).toBe(10);
    expect(loaded?.trees[1]?.destroyed).toBeUndefined();
    expect(base.trees[0]?.destroyed).toBeUndefined();
  });
  it("keeps both computers' digs when a conflicting edit is replayed", () => {
    const base = snapshot([], [], createTrees(), player, 0);
    const first = applyWorldEdit(base, edit(50, 1));
    const second = applyWorldEdit(first, edit(60, 2));
    expect(second.holes.map((h) => h.id)).toEqual([1, 2]);
  });
  it("puts missing tools back on the shelf of an older save", () => {
    const old = snapshot([], [], createTrees(), player, 0);
    old.tools = [{ kind: "shovel" }];
    const loaded = sharedSave(old, player);
    expect(loaded?.tools?.map((t) => t.kind).sort()).toEqual(["broom", "shovel", "weapon"]);
  });
  it("shares rooms and furniture without moving the other player", () => {
    const base = snapshot([], [{ x: 0, z: 16.2, floor: -3.2, shaft: 123, room: true }], createTrees(), { ...player, x: 90 }, 50);
    const loaded = sharedSave(base, player);
    expect(loaded?.player.x).toBe(0);
    expect(loaded?.tunnels).toEqual(base.tunnels);
    expect(tunnelFurnishings(loaded?.tunnels ?? [])).toHaveLength(1);
  });
});