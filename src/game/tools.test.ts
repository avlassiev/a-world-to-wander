import { describe, expect, it } from "vitest";
import { defaultTools, heldTool, nearShelf, nextFreeTool, releaseOrphanedTools, returnTool, takeTool } from "./tools";
import { SHELF } from "./world";

const atShelf = { x: SHELF.x - 1, y: 0, z: SHELF.z, vy: 0 };

describe("tool shed", () => {
  it("a visitor at the shelf takes the shovel, then holds it", () => {
    const tools = takeTool(defaultTools(), "shovel", atShelf, "me");
    expect(heldTool(tools, "me")).toBe("shovel");
    expect(nearShelf(atShelf)).toBe(true);
  });
  it("tools cannot be taken far from the shed or while underground", () => {
    expect(takeTool(defaultTools(), "shovel", { x: 30, y: 0, z: 30, vy: 0 }, "me")).toEqual(defaultTools());
    expect(takeTool(defaultTools(), "shovel", { ...atShelf, y: -3, buried: { x: 0, z: 0, r: 1, d: 3 } }, "me")).toEqual(defaultTools());
  });
  it("hands hold one tool at a time", () => {
    const withShovel = takeTool(defaultTools(), "shovel", atShelf, "me");
    expect(takeTool(withShovel, "broom", atShelf, "me")).toEqual(withShovel);
  });
  it("a tool already taken by someone else stays theirs", () => {
    const withShovel = takeTool(defaultTools(), "shovel", atShelf, "me");
    expect(takeTool(withShovel, "shovel", atShelf, "you")).toEqual(withShovel);
    expect(nextFreeTool(withShovel, atShelf, "you")).toBe("broom");
  });
  it("returning puts the tool back on the shelf for everyone", () => {
    const withShovel = takeTool(defaultTools(), "shovel", atShelf, "me");
    const back = returnTool(withShovel, "me");
    expect(heldTool(back, "me")).toBeNull();
    expect(back).toEqual(defaultTools());
  });
  it("a tool left behind by a player who closed the game returns to the shelf", () => {
    const tools = takeTool(takeTool(defaultTools(), "shovel", atShelf, "me"), "broom", atShelf, "gone");
    const freed = releaseOrphanedTools(tools, new Set(["me"]));
    expect(heldTool(freed, "me")).toBe("shovel");
    expect(freed.find((t) => t.kind === "broom")?.owner).toBeUndefined();
    expect(releaseOrphanedTools(tools, new Set(["me", "gone"]))).toEqual(tools);
  });
  it("the shelf offers the first free tool and nothing when hands are full", () => {
    expect(nextFreeTool(defaultTools(), atShelf, "me")).toBe("shovel");
    const withShovel = takeTool(defaultTools(), "shovel", atShelf, "me");
    expect(nextFreeTool(withShovel, atShelf, "me")).toBeNull();
  });
});
