import { describe, expect, it } from "vitest";
import { daylightAt, DAY_NIGHT_SECONDS } from "./daylight";

describe("repeating day and night", () => {
  it("changes day to night and back, repeatedly", () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(daylightAt(cycle * DAY_NIGHT_SECONDS).daylight).toBe(1);
      expect(daylightAt(cycle * DAY_NIGHT_SECONDS + DAY_NIGHT_SECONDS / 2).daylight).toBe(0);
    }
  });
  it("smoothly changes the light at the horizon", () => {
    const before = daylightAt(60 - 0.001).daylight;
    const after = daylightAt(60 + 0.001).daylight;
    expect(before).toBeGreaterThan(after);
    expect(before - after).toBeLessThan(0.001);
  });
  it("gives the same sky after a full cycle or reopening", () => {
    expect(daylightAt(32 + DAY_NIGHT_SECONDS)).toEqual(daylightAt(32));
    expect(daylightAt(-DAY_NIGHT_SECONDS / 2).daylight).toBe(0);
  });
});