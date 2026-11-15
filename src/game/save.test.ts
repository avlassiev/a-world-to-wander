import { describe, expect, it } from "vitest";
import { snapshot, parseSave } from "./save";
import { createTrees, digHole, digTunnel, fillHole, tunnelFurnishings } from "./world";

describe("saved excavation", () => {
  it("restores the excavated tunnel, table, two chairs, kitchen and toilet after reopening", () => {
    let holes = digHole([], 0, 15, 123);
    for (let i = 0; i < 4; i++) holes = digHole(holes, 0, 15, 123);
    const player = { x: 0, y: -3.2, z: 15, vy: 0 };
    const tunnels = digTunnel(holes, [], player, 0, 1);
    const restored = parseSave(JSON.parse(JSON.stringify(snapshot(holes, tunnels, createTrees(), player, 100))));
    expect(restored?.tunnels).toEqual([{ x: 0, z: 16.2, floor: -3.2, shaft: 123, room: true }]);
    const furniture = tunnelFurnishings(restored?.tunnels ?? []);
    expect(furniture).toHaveLength(1);
    expect(furniture[0]?.chairs).toHaveLength(2);
    expect(furniture[0]?.table.x1).toBe(-1.9);
    expect(furniture[0]?.kitchen.x1).toBe(-1.9);
    expect(furniture[0]?.toilet.x1).toBe(1.25);
    expect(restored?.player).toEqual(player);
  });
  it("keeps tunnels after filling the entrance and reopening the game", () => {
    const tunnels = [{ x: 0, z: 16.2, floor: -3.2, shaft: 123, room: true }];
    const filled = fillHole([{ x: 0, z: 15, r: 1.2, d: 3.2, id: 123 }], createTrees(), 0, 15);
    const restored = parseSave(JSON.parse(JSON.stringify(snapshot(filled.holes, tunnels, filled.trees, { x: 0, y: 0, z: 6, vy: 0 }, 50))));
    expect(restored?.holes).toEqual([]);
    expect(restored?.tunnels).toEqual(tunnels);
  });
  it("rejects corrupt saves rather than loading broken excavation", () => {
    expect(parseSave({ version: 1, tunnels: [{ floor: "broken" }] })).toBeNull();
  });
});