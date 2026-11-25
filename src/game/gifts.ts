import { calendarAt, santaVisit } from "./calendar";
import type { Body } from "./world";

/** Ded Moroz stands this far from the player; his gift box lies at his feet. */
export const MOROZ_X = 2.5;
export const MOROZ_Z = -2.5;
export const GIFT_REACH = 3;

export type GiftState = { year: number; gift: string; x: number; y: number; z: number; carried: boolean; opened?: boolean; bites?: number; eaten?: boolean };

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

/** Opening shows what is inside; a lollipop has a few bites, paints can colour things. */
export const CANDY_BITES = 3;
export const PAINT_COLORS = ["#e53935", "#fdd835", "#43a047", "#1e88e5"] as const;
export const MAX_PAINT = 400;

export function openGift(state: GiftState): GiftState {
  if (state.opened) return state;
  return { ...state, opened: true, ...(state.gift === "🍭" ? { bites: CANDY_BITES } : {}) };
}

/** One bite of an opened, held lollipop; the last bite eats it up. */
export function biteCandy(state: GiftState): GiftState {
  if (state.gift !== "🍭" || !state.opened || !state.carried || state.eaten) return state;
  const bites = Math.max(0, (state.bites ?? CANDY_BITES) - 1);
  return bites === 0 ? { ...state, bites, eaten: true, carried: false } : { ...state, bites };
}

export function canPaint(state: GiftState | null) {
  return !!state && state.gift === "🎨" && !!state.opened && state.carried;
}

export type PaintMark = { x: number; y: number; z: number; nx: number; ny: number; nz: number; color: string };
const PAINT_KEY = "forest-paint-v1";
export function readPaint(storage: Pick<Storage, "getItem"> = localStorage): PaintMark[] {
  try { const v = JSON.parse(storage.getItem(PAINT_KEY) ?? "[]"); return Array.isArray(v) ? v as PaintMark[] : []; } catch { return []; }
}
export function writePaint(marks: PaintMark[], storage: Pick<Storage, "setItem"> = localStorage) {
  try { storage.setItem(PAINT_KEY, JSON.stringify(marks)); } catch { /* ignore */ }
}
export function addPaint(marks: PaintMark[], mark: PaintMark) {
  return [...marks, mark].slice(-MAX_PAINT);
}
