import { z } from "zod";

const poseSchema = z.object({
  id: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  x: z.number().finite().min(-500).max(500),
  y: z.number().finite().min(-20).max(100),
  z: z.number().finite().min(-500).max(500),
  yaw: z.number().finite().min(-Math.PI).max(Math.PI),
  pitch: z.number().finite().min(-Math.PI / 2).max(Math.PI / 2),
  moving: z.boolean(),
  buried: z.boolean(),
  carrying: z.boolean().default(false),
  tool: z.enum(["shovel", "broom", "weapon"]).nullable().default(null),
});

export type PlayerPose = z.infer<typeof poseSchema>;
export type Peer = { pose: PlayerPose; received: number };

export function acceptPose(peers: Map<string, Peer>, value: unknown, self: string, now: number) {
  const parsed = poseSchema.safeParse(value);
  if (!parsed.success || parsed.data.id === self) return false;
  const pose = parsed.data;
  const old = peers.get(pose.id);
  if (old && old.pose.seq >= pose.seq) return false;
  peers.set(pose.id, { pose, received: now });
  return !old;
}

export function turnTowards(from: number, to: number, blend: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * blend;
}

export function walkSwing(moving: boolean, phase: number) {
  return moving ? Math.sin(phase) * 0.55 : 0;
}