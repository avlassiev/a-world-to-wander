import { describe, expect, it } from "vitest";
import { calendarAt, santaVisit, YEAR_SECONDS, VISIT_SECONDS } from "./calendar";

describe("years and Ded Moroz", () => {
  it("years follow one another", () => {
    expect(calendarAt(0).year).toBe(0);
    expect(calendarAt(YEAR_SECONDS).year).toBe(1);
    expect(calendarAt(3 * YEAR_SECONDS + 1).year).toBe(3);
  });
  it("counts days until New Year", () => {
    expect(calendarAt(YEAR_SECONDS - 1).daysLeft).toBe(1);
  });
  it("comes on New Year to whoever wrote a list in time", () => {
    expect(santaVisit(YEAR_SECONDS + 5, { 0: "🧸" })).toEqual({ gift: "🧸" });
  });
  it("brings nothing to whoever did not write a list", () => {
    expect(santaVisit(YEAR_SECONDS + 5, {})).toEqual({ gift: null });
  });
  it("still brings the gift when the list is written while he is visiting", () => {
    expect(santaVisit(YEAR_SECONDS + 5, { 1: "🚗" })).toEqual({ gift: "🚗" });
  });
  it("does not come in the middle of the year", () => {
    expect(santaVisit(YEAR_SECONDS + VISIT_SECONDS + 1, { 0: "🧸" })).toBeNull();
  });
});
