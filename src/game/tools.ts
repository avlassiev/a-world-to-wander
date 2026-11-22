// Pure rules for the tool shed: which tool is held, who may take it. No React/three imports.
import { SHELF, type Body } from "./world";

export const TOOL_KINDS = ["shovel", "broom", "weapon"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];
export type Tool = { kind: ToolKind; owner?: string | undefined };
export const TOOL_REACH = 2.6;

export function defaultTools(): Tool[] {
  return TOOL_KINDS.map((kind) => ({ kind }));
}

/** The tool a player holds, or null when their hands are free. */
export function heldTool(tools: Tool[], owner: string): ToolKind | null {
  return (owner ? tools.find((t) => t.owner === owner)?.kind : undefined) ?? null;
}

/** Tools are taken and returned at the shed shelf, standing on the ground. */
export function nearShelf(player: Body) {
  return !player.buried && Math.abs(player.y) < 1 && Math.hypot(player.x - SHELF.x, player.z - SHELF.z) <= TOOL_REACH;
}

export function takeTool(tools: Tool[], kind: ToolKind, player: Body, owner: string): Tool[] {
  if (!owner || heldTool(tools, owner) || !nearShelf(player)) return tools;
  const tool = tools.find((t) => t.kind === kind);
  if (!tool || tool.owner) return tools;
  return tools.map((t) => (t.kind === kind ? { ...t, owner } : t));
}

/** Returning works from anywhere: the tool jumps back onto the shelf. */
export function returnTool(tools: Tool[], owner: string): Tool[] {
  if (!owner) return tools;
  return tools.map((t) => (t.owner === owner ? { kind: t.kind } : t));
}

/** The next free tool a visitor at the shelf would take, in shelf order. */
export function nextFreeTool(tools: Tool[], player: Body, owner: string): ToolKind | null {
  if (!owner || heldTool(tools, owner) || !nearShelf(player)) return null;
  return tools.find((t) => !t.owner)?.kind ?? null;
}
