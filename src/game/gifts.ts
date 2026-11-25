import { calendarAt, santaVisit } from "./calendar";
import type { Body } from "./world";

/** Ded Moroz stands this far from the player; his gift box lies at his feet. */
export const MOROZ_X = 2.5;
export const MOROZ_Z = -2.5;
export const GIFT_REACH = 3;

export type GiftState = { year: number; gift: string; x: number; y: number; z: number; carried: boolean };

const GIFT_KEY = "forest-santa-gifts-v1";

export function readGifts(storage: Pick<Storage, "getItem"> = localStorage): Record<number, GiftState> {
  try { return JSON.parse(storage.getItem(GIFT_KEY) ?? "{}") as Record<number, GiftState>; } catch { return {}; }
}

export function writeGifts(gifts: Record<number, GiftState>, storage: Pick<Storage, "setItem"> = localStorage) {
  try { storage.setItem(GIFT_KEY, JSON.stringify(gifts)); } catch { /* Private mode: the gift just stays for this visit. */ }
}

/** The box Ded Moroz leaves while he visits: only with a delivered wish, and only until taken. */
export function giftBox(seconds: number, wishes: Record<number, string>, taken: Record<number, GiftState>) {
  const visit = santaVisit(seconds, wishes);
  if (!visit?.gift) return null;
  const { year } = calendarAt(seconds);
  if (taken[year]) return null;
  return { year, gift: visit.gift };
}

export function nearGift(pos: Body, x: number, z: number) {
  return !pos.buried && pos.y > -0.5 && Math.hypot(pos.x - x, pos.z - z) <= GIFT_REACH;
}

export function takeGift(box: { year: number; gift: string }, pos: Body): GiftState {
  return { year: box.year, gift: box.gift, x: pos.x, y: pos.y, z: pos.z, carried: true };
}

export function dropGift(state: GiftState, pos: Body): GiftState {
  return { ...state, x: pos.x, y: pos.y, z: pos.z, carried: false };
}
