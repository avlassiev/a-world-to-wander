import { describe, expect, it } from "vitest";
import { carriedTree, cutTree, dropTimber, nearbyTimber, pickTimber } from "./timber";
import { applyWorldEdit, sharedSave } from "./shared";
import { snapshot } from "./save";
import { treeAhead, attractTrees, type FallingTree } from "./world";

const trees: FallingTree[] = [{ x: 20, z: 20, s: 1, birth: -100 }, { x: 22, z: 20, s: 1, birth: -100 }];
const player = { x: 20, y: 0, z: 22, vy: 0 };
describe("sawing and taking trees home", () => {
  it("saws the facing tree into a log without exploding it", () => {
    const result = cutTree(trees, treeAhead(trees, player, 0, -1, 10), 10);
    expect(result[0]?.cutAt).toBe(10);
    expect(result[0]?.destroyed).toBeUndefined();
    expect(result[0]?.timber).toEqual({ x: 20, y: 0, z: 20 });
    expect(result[1]?.cutAt).toBeUndefined();
  });
  it("picks up the cut log after the tree falls", () => {
    const cut = cutTree(trees, 0, 10);
    expect(nearbyTimber(cut, player, 10)).toBe(-1);
    expect(nearbyTimber(cut, player, 11)).toBe(0);
    expect(carriedTree(pickTimber(cut, 0, player, "one", 11), "one")).toBe(0);
  });
  it("carries only one log and cannot take another player's log", () => {
    const cut = cutTree(cutTree(trees, 0, 10), 1, 10);
    const held = pickTimber(cut, 0, player, "one", 11);
    expect(pickTimber(held, 1, player, "one", 11)).toBe(held);
    expect(pickTimber(held, 0, player, "two", 11)).toBe(held);
  });
  it("leaves the same log inside the house, then restores it on another computer", () => {
    const base = snapshot([], [], trees, player, 10);
    const cut = applyWorldEdit(base, { kind: "cut", x: 0, z: -1, id: 0, time: 10, player });
    const held = applyWorldEdit(cut, { kind: "pickup", x: 0, z: -1, id: 0, time: 11, player, owner: "one" });
    const home = { x: 0, y: 0, z: -7, vy: 0 };
    const dropped = applyWorldEdit(held, { kind: "drop", x: 0, z: -1, id: 0, time: 12, player: home, owner: "one" });
    const restored = sharedSave(JSON.parse(JSON.stringify(dropped)), player);
    expect(restored?.trees[0]?.timber).toEqual({ x: 0, y: 0, z: -7 });
    expect(carriedTree(restored?.trees ?? [], "one")).toBe(-1);
    expect(trees[0]?.cutAt).toBeUndefined();
  });
  it("restores a log still being carried after reopening", () => {
    const held = pickTimber(cutTree(trees, 0, 10), 0, player, "one", 11);
    const restored = sharedSave(JSON.parse(JSON.stringify(snapshot([], [], held, player, 11))), player);
    expect(carriedTree(restored?.trees ?? [], "one")).toBe(0);
  });
  it("replaying two competing pickups cannot duplicate a log", () => {
    const cut = snapshot([], [], cutTree(trees, 0, 10), player, 11);
    const first = applyWorldEdit(cut, { kind: "pickup", id: 0, time: 11, x: 0, z: 0, player, owner: "one" });
    const second = applyWorldEdit(first, { kind: "pickup", id: 0, time: 11, x: 0, z: 0, player, owner: "two" });
    expect(second.trees[0]?.timber?.owner).toBe("one");
    expect(carriedTree(second.trees, "two")).toBe(-1);
  });
  it("does not grow or pull a cut tree into a new pit", () => {
    const cut = cutTree(trees, 0, 10);
    attractTrees(cut, { x: 20, z: 20, r: 1, d: 2, id: 1 }, 12, true);
    expect(cut[0]?.fall).toBeUndefined();
    expect(treeAhead(cut, player, 0, -1, 12)).toBe(-1);
    expect(dropTimber(cut, 0, player, "two")).toBe(cut);
  });
});