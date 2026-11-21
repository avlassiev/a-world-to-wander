import { parseSave, type WorldSave } from "./save";
import { attractTrees, createTrees, digHole, digTunnel, explodeTree, fillHole, recoverTrees, type Body } from "./world";

export type WorldEdit = { kind: "dig" | "fill" | "tunnel" | "blast"; x: number; z: number; id: number; time: number; player: Body };
export function sharedSave(value: unknown, player: Body): WorldSave | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const saved = parseSave({ ...value, player });
  // Older worlds stored only the 40 nearby trees; distant visible trees now share the same rules.
  if (saved?.trees.length === 40) saved.trees.push(...createTrees().slice(40));
  return saved;
}
export function applyWorldEdit(saved: WorldSave, edit: WorldEdit): WorldSave {
  const next = structuredClone(saved);
  next.time = Math.max(next.time, edit.time);
  if (edit.kind === "dig") {
    const previous = next.holes;
    next.holes = digHole(previous, edit.x, edit.z, edit.id);
    for (const pit of next.holes) {
      recoverTrees(next.trees, pit, next.time);
      const old = previous.find((h) => h.id === pit.id);
      if (!old || old.d !== pit.d || old.r !== pit.r) attractTrees(next.trees, pit, next.time, !old);
    }
  } else if (edit.kind === "fill") {
    const filled = fillHole(next.holes, next.trees, edit.x, edit.z);
    next.holes = filled.holes;
    next.trees = filled.trees;
  } else if (edit.kind === "blast") next.trees = explodeTree(next.trees, edit.id, edit.time);
  else next.tunnels = digTunnel(next.holes, next.tunnels, edit.player, edit.x, edit.z);
  next.savedAt = Date.now();
  return next;
}