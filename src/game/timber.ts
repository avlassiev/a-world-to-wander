import { treePose, type Body, type FallingTree } from "./world";

export const CUT_SECONDS = 0.8;
export const TIMBER_REACH = 3.5;

export function cutTree(trees: FallingTree[], index: number, time: number): FallingTree[] {
  const tree = trees[index];
  if (!tree || tree.destroyed || tree.buried || tree.cutAt !== undefined) return trees;
  const pose = treePose(tree, time);
  return trees.map((tr, i) => i === index ? { ...tr, cutAt: time, timber: { x: pose.x, y: pose.y, z: pose.z } } : tr);
}

export function carriedTree(trees: FallingTree[], owner: string) {
  return owner ? trees.findIndex((tree) => tree.timber?.owner === owner) : -1;
}

export function nearbyTimber(trees: FallingTree[], player: Body, time: number) {
  let nearest = TIMBER_REACH;
  let index = -1;
  trees.forEach((tree, i) => {
    const log = tree.timber;
    if (!log || log.owner || tree.cutAt === undefined || time < tree.cutAt + CUT_SECONDS) return;
    const distance = Math.hypot(log.x - player.x, log.y - player.y, log.z - player.z);
    if (distance <= nearest) { index = i; nearest = distance; }
  });
  return index;
}

export function pickTimber(trees: FallingTree[], index: number, player: Body, owner: string, time: number): FallingTree[] {
  const tree = trees[index];
  const log = tree?.timber;
  if (!owner || player.buried || carriedTree(trees, owner) >= 0 || !tree || !log || log.owner || tree.cutAt === undefined || time < tree.cutAt + CUT_SECONDS || Math.hypot(log.x - player.x, log.y - player.y, log.z - player.z) > TIMBER_REACH) return trees;
  return trees.map((tr, i) => i === index ? { ...tr, timber: { ...log, owner } } : tr);
}

export function dropTimber(trees: FallingTree[], index: number, player: Body, owner: string): FallingTree[] {
  const tree = trees[index];
  if (!owner || !tree?.timber || tree.timber.owner !== owner || player.buried) return trees;
  // Put the log at the player's feet, so it can be left inside the house without crossing a wall.
  return trees.map((tr, i) => i === index ? { ...tr, timber: { x: player.x, y: player.y, z: player.z } } : tr);
}

/** This is a cosmetic game identity, not authentication or an access-control credential. */
export function timberOwner(storage: Storage): string {
  const existing = storage.getItem("forest-timber-owner");
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const owner = crypto.randomUUID();
  storage.setItem("forest-timber-owner", owner);
  return owner;
}