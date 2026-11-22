import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHED, SHED_DOOR, SHELF } from "./world";
import { TOOL_KINDS, heldTool, nextFreeTool, type Tool, type ToolKind } from "./tools";
import type { Body } from "./world";

export const TOOL_ICONS: Record<ToolKind, string> = { shovel: "⛏️", broom: "🧹", weapon: "⚔️" };

/** Small model of one tool, standing upright at the origin. */
export function ToolPiece({ kind }: { kind: ToolKind }) {
  if (kind === "shovel") return <group>
    <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.9, 8]} /><meshStandardMaterial color="#9a6a40" /></mesh>
    <mesh position={[0, -0.08, 0]} castShadow><boxGeometry args={[0.22, 0.3, 0.04]} /><meshStandardMaterial color="#8a939c" metalness={0.6} roughness={0.35} /></mesh>
  </group>;
  if (kind === "broom") return <group>
    <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.022, 0.022, 1.0, 8]} /><meshStandardMaterial color="#b5804f" /></mesh>
    <mesh position={[0, -0.12, 0]} castShadow><coneGeometry args={[0.14, 0.35, 10]} /><meshStandardMaterial color="#d9b24a" flatShading /></mesh>
  </group>;
  return <group>
    <mesh position={[0, 0.32, 0]} castShadow><boxGeometry args={[0.07, 0.55, 0.02]} /><meshStandardMaterial color="#c98a52" /></mesh>
    <mesh position={[0, 0.05, 0]} castShadow><boxGeometry args={[0.22, 0.05, 0.04]} /><meshStandardMaterial color="#6b4526" /></mesh>
    <mesh position={[0, -0.08, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 0.22, 8]} /><meshStandardMaterial color="#6b4526" /></mesh>
  </group>;
}

/** The shed building with an open door facing the house and a shelf inside. */
export function Shed({ tools }: { tools: RefObject<Tool[]> }) {
  const { x1, x2, z1, z2, h, t } = SHED;
  const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const wall = "#b98a5a";
  const slots: Record<ToolKind, number> = { shovel: -1.0, broom: 0, weapon: 1.0 };
  const shelfRefs = useRef<Partial<Record<ToolKind, THREE.Group | null>>>({});
  useFrame(() => {
    for (const tool of tools.current) {
      const g = shelfRefs.current[tool.kind];
      if (g) g.visible = !tool.owner;
    }
  });
  return <group>
    {/* floor */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, cz]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#8a6a45" />
    </mesh>
    {/* back, right, front walls */}
    <mesh position={[cx, h / 2, z1 + t / 2]} castShadow><boxGeometry args={[w, h, t]} /><meshStandardMaterial color={wall} /></mesh>
    <mesh position={[x2 - t / 2, h / 2, cz]} castShadow><boxGeometry args={[t, h, d]} /><meshStandardMaterial color={wall} /></mesh>
    <mesh position={[cx, h / 2, z2 - t / 2]} castShadow><boxGeometry args={[w, h, t]} /><meshStandardMaterial color={wall} /></mesh>
    {/* left wall with door opening */}
    <mesh position={[x1 + t / 2, h / 2, (z1 + SHED_DOOR.z1) / 2]} castShadow><boxGeometry args={[t, h, SHED_DOOR.z1 - z1]} /><meshStandardMaterial color={wall} /></mesh>
    <mesh position={[x1 + t / 2, h / 2, (z2 + SHED_DOOR.z2) / 2]} castShadow><boxGeometry args={[t, h, z2 - SHED_DOOR.z2]} /><meshStandardMaterial color={wall} /></mesh>
    <mesh position={[x1 + t / 2, (h + SHED_DOOR.h) / 2, (SHED_DOOR.z1 + SHED_DOOR.z2) / 2]} castShadow><boxGeometry args={[t, h - SHED_DOOR.h, SHED_DOOR.z2 - SHED_DOOR.z1]} /><meshStandardMaterial color={wall} /></mesh>
    {/* slanted roof */}
    <mesh position={[cx, h + 0.28, cz]} rotation={[0, 0, -0.18]} castShadow>
      <boxGeometry args={[w + 0.6, 0.1, d + 0.6]} />
      <meshStandardMaterial color="#7a4e2d" />
    </mesh>
    {/* shelf planks on the right wall */}
    {[0.55, 1.05].map((y) => <mesh key={y} position={[SHELF.x, y, SHELF.z]} castShadow><boxGeometry args={[0.7, 0.06, 2.6]} /><meshStandardMaterial color="#6b4526" /></mesh>)}
    {(["shovel", "broom", "weapon"] as ToolKind[]).map((kind) => (
      <group key={kind} ref={(el) => { shelfRefs.current[kind] = el; }} position={[SHELF.x, 1.1, SHELF.z + (slots[kind] ?? 0)]} rotation={[0, 0, -0.12]}>
        <ToolPiece kind={kind} />
      </group>
    ))}
    <pointLight position={[cx, h - 0.4, cz]} intensity={5} distance={6} decay={1.5} color="#ffd9a0" />
  </group>;
}

/** The tool the local player holds, glued to the camera in first-person view. */
export function HeldTool({ tools, owner, thirdPerson }: { tools: RefObject<Tool[]>; owner: RefObject<string>; thirdPerson: RefObject<boolean> }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const kind = useRef<ToolKind | null>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const held = heldTool(tools.current, owner.current);
    kind.current = held;
    g.visible = !!held && !thirdPerson.current;
    if (!g.visible) return;
    camera.updateMatrixWorld();
    g.position.set(0.42, -0.42, -0.7).applyMatrix4(camera.matrixWorld);
    g.rotation.set(0.3, camera.rotation.y, 0.15);
    for (const child of g.children) child.visible = child.name === `tool-${held}`;
  });
  return <group ref={group} visible={false} name="held-tool">
    {(["shovel", "broom", "weapon"] as ToolKind[]).map((k) => <group key={k} name={`tool-${k}`} scale={0.8}><ToolPiece kind={k} /></group>)}
  </group>;
}

/** Buttons near the shelf: take the shovel, broom or sword, or put the held one back. */
export function ToolControls({ tools, player, owner, onUse }: { tools: RefObject<Tool[]>; player: RefObject<Body>; owner: RefObject<string>; onUse: (kind?: ToolKind) => void }) {
  const [state, setState] = useState<{ held: ToolKind | null; free: ToolKind[] }>({ held: null, free: [] });
  useEffect(() => {
    const refresh = () => {
      const held = heldTool(tools.current, owner.current);
      const free = held ? [] : TOOL_KINDS.filter((kind) => {
        const tool = tools.current.find((t) => t.kind === kind);
        return tool && !tool.owner && nextFreeTool([tool], player.current, owner.current) === kind;
      });
      setState((old) => old.held === held && old.free.join() === free.join() ? old : { held, free });
    };
    refresh();
    const timer = setInterval(refresh, 200);
    return () => clearInterval(timer);
  }, [tools, player, owner]);
  return <div className="game-shed-tools">
    {state.held && <div className="game-tool-badge" aria-hidden="true">{TOOL_ICONS[state.held]}</div>}
    {state.held ? (
      <Button className="game-tool" aria-label="Вернуть инструмент" title="Вернуть инструмент" onClick={(event) => { event.currentTarget.blur(); onUse(); }}>
        <ArrowDownToLine aria-hidden="true" />
      </Button>
    ) : (["shovel", "broom", "weapon"] as ToolKind[]).map((kind) => (
      <Button key={kind} className="game-tool" disabled={!state.free.includes(kind)} aria-label={`Взять: ${TOOL_ICONS[kind]}`} title={`Взять: ${TOOL_ICONS[kind]}`} onClick={(event) => { event.currentTarget.blur(); onUse(kind); }}>
        <span aria-hidden="true">{TOOL_ICONS[kind]}</span>
      </Button>
    ))}
  </div>;
}
