import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR, YEAR_SECONDS } from "./calendar";
import { DAY_NIGHT_SECONDS } from "./daylight";
import { addPaint, biteCandy, canPaint, dropGift, giftBox, GIFT_REACH, MAX_PAINT, nearGift, openGift, takeGift } from "./gifts";
import type { Body } from "./world";

const at = (x: number, z: number, extra: Partial<Body> = {}): Body => ({ x, y: 0, z, vy: 0, ...extra });
/** The middle of New Year day of year 1, when a wish from year 0 is delivered. */
const NEW_YEAR = YEAR_SECONDS + DAY_NIGHT_SECONDS / 2;

describe("giftBox", () => {
  it("leaves a box while Ded Moroz visits with a delivered wish", () => {
    expect(giftBox(NEW_YEAR, { 0: "🧸" }, {})).toEqual({ year: 1, gift: "🧸" });
  });

  it("leaves nothing without a wish", () => {
    expect(giftBox(NEW_YEAR, {}, {})).toBeNull();
  });

  it("leaves nothing once the gift was taken", () => {
    const taken = { 1: { year: 1, gift: "🧸", x: 0, y: 0, z: 0, carried: false } };
    expect(giftBox(NEW_YEAR, { 0: "🧸" }, taken)).toBeNull();
  });

  it("leaves nothing after the visit ends", () => {
    const later = YEAR_SECONDS + DAYS_PER_YEAR * DAY_NIGHT_SECONDS - 1;
    expect(giftBox(later, { 0: "🧸" }, {})).toBeNull();
  });
});

describe("nearGift", () => {
  it("reaches a box within reach and not a far one", () => {
    expect(nearGift(at(0, 0), GIFT_REACH - 0.1, 0)).toBe(true);
    expect(nearGift(at(0, 0), GIFT_REACH + 0.1, 0)).toBe(false);
  });

  it("cannot be reached while buried or underground", () => {
    expect(nearGift(at(0, 0, { buried: { x: 0, z: 0, r: 1, d: 1 } }), 0, 0)).toBe(false);
    expect(nearGift(at(0, 0, { y: -2 }), 0, 0)).toBe(false);
  });
});

describe("takeGift / dropGift", () => {
  it("carries the gift and drops it where the player stands", () => {
    const held = takeGift({ year: 1, gift: "🚗" }, at(3, 4));
    expect(held).toMatchObject({ year: 1, gift: "🚗", carried: true });
    const dropped = dropGift(held, at(10, -2));
    expect(dropped).toMatchObject({ gift: "🚗", x: 10, z: -2, carried: false });
  });
});

describe("opening gifts", () => {
  const held = (gift: string) => takeGift({ year: 1, gift }, at(0, 0));
  it("a lollipop is eaten in three bites", () => {
    let g = openGift(held("🍭"));
    g = biteCandy(g); g = biteCandy(g);
    expect(g.eaten).toBeFalsy();
    g = biteCandy(g);
    expect(g).toMatchObject({ eaten: true, carried: false });
  });
  it("an unopened lollipop cannot be bitten", () => {
    expect(biteCandy(held("🍭")).bites).toBeUndefined();
  });
  it("only opened paints in hands can paint", () => {
    expect(canPaint(held("🎨"))).toBe(false);
    expect(canPaint(openGift(held("🎨")))).toBe(true);
    expect(canPaint(openGift(held("🧸")))).toBe(false);
  });
  it("keeps at most MAX_PAINT marks", () => {
    const m = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, color: "#fff" };
    let marks: ReturnType<typeof addPaint> = [];
    for (let i = 0; i < MAX_PAINT + 5; i++) marks = addPaint(marks, m);
    expect(marks.length).toBe(MAX_PAINT);
  });
});
