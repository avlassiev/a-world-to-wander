import { describe, expect, it } from "vitest";
import { acceptPose, turnTowards, walkSwing, type Peer } from "./multiplayer";

const self = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const pose = { id: other, seq: 1, x: 2, y: 0, z: 6, yaw: 0, pitch: 0, moving: false, buried: false };

describe("visible players", () => {
  it("receives another player's walking position", () => {
    const peers = new Map<string, Peer>();
    acceptPose(peers, { ...pose, x: 3, moving: true }, self, 100);
    expect(peers.get(other)?.pose.x).toBe(3);
    expect(peers.get(other)?.pose.moving).toBe(true);
    expect(walkSwing(true, Math.PI / 2)).toBeCloseTo(0.55);
  });
  it("stops the legs when the other player stands still", () => {
    expect(walkSwing(false, Math.PI / 2)).toBe(0);
  });
  it("shows turning even without walking", () => {
    const peers = new Map<string, Peer>();
    acceptPose(peers, { ...pose, yaw: Math.PI / 2 }, self, 100);
    expect(peers.get(other)?.pose.yaw).toBe(Math.PI / 2);
    expect(turnTowards(0, Math.PI / 2, 1)).toBe(Math.PI / 2);
  });
  it("turns across the angle boundary by the shortest direction", () => {
    expect(turnTowards(Math.PI - 0.1, -Math.PI + 0.1, 1)).toBeCloseTo(Math.PI + 0.1);
  });
  it("does not show oneself or replay older positions", () => {
    const peers = new Map<string, Peer>();
    expect(acceptPose(peers, { ...pose, id: self }, self, 100)).toBe(false);
    acceptPose(peers, { ...pose, seq: 2, x: 4 }, self, 100);
    acceptPose(peers, pose, self, 200);
    expect(peers.get(other)?.pose.x).toBe(4);
  });
  it("rejects invalid remote positions", () => {
    const peers = new Map<string, Peer>();
    acceptPose(peers, { ...pose, x: Infinity }, self, 100);
    expect(peers.size).toBe(0);
  });
});