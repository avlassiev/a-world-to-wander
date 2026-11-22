import { EYE, type Body } from "./world";

export const CHASE_DISTANCE = 3.8;
export function chasePosition(player: Body, forward: { x: number; y: number; z: number }, distance = CHASE_DISTANCE) {
  return { x: player.x - forward.x * distance, y: player.y + EYE + 0.25 - forward.y * distance, z: player.z - forward.z * distance };
}