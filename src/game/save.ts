import { z } from "zod";
import type { Body, FallingTree, Pit, Tunnel } from "./world";

const number = z.number().finite();
const shape = z.object({ x: number, z: number, r: number.positive(), d: number.positive() });
const pit = shape.extend({ id: number });
export const saveSchema = z.object({
  version: z.literal(1), savedAt: number, time: number.nonnegative(),
  holes: z.array(pit).max(150),
  tunnels: z.array(z.object({ x: number, z: number, floor: number, shaft: number, room: z.boolean().optional() })),
  trees: z.array(z.object({ x: number, z: number, s: number, birth: number, buried: z.boolean().optional(), destroyed: z.boolean().optional(), cutAt: number.optional(), timber: z.object({ x: number, y: number, z: number, owner: z.string().optional() }).optional(), explosion: z.object({ x: number, y: number, z: number, time: number }).optional(), fall: z.object({ hole: pit, started: number }).optional() })),
  player: z.object({ x: number, y: number, z: number, vy: number, buried: shape.optional() }),
});
export type WorldSave = z.infer<typeof saveSchema>;
export function snapshot(holes: Pit[], tunnels: Tunnel[], trees: FallingTree[], player: Body, time: number): WorldSave {
  return saveSchema.parse({ version: 1, savedAt: Date.now(), holes, tunnels, trees, player, time });
}
export function parseSave(value: unknown): WorldSave | null {
  const result = saveSchema.safeParse(value);
  return result.success ? result.data : null;
}

// Browser storage is an immediate recovery journal, not the primary durable store.
export const JOURNAL_KEY = "forest-world-journal-v1";
export const DEVICE_KEY = "forest-world-device-v1";
export function deviceKey(storage: Storage): string {
  const previous = storage.getItem(DEVICE_KEY);
  if (previous && /^[a-f0-9]{64}$/.test(previous)) return previous;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  storage.setItem(DEVICE_KEY, key);
  return key;
}
export function readJournal(storage: Storage): WorldSave | null {
  try { return parseSave(JSON.parse(storage.getItem(JOURNAL_KEY) ?? "null")); }
  catch { return null; }
}