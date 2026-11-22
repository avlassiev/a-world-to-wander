import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { snapshot } from "./save";
import { applyWorldEdit, sharedSave, type WorldEdit } from "./shared";
import { Button } from "@/components/ui/button";
import { Play, Eye, PersonStanding } from "lucide-react";
import { Multiplayer, Avatar } from "./Multiplayer";
import { CHASE_DISTANCE, chasePosition } from "./camera";
import { type Peer } from "./multiplayer";
import { TreeBursts } from "./TreeBursts";
import { Timber } from "./Timber";
import { TimberControls } from "./TimberControls";
import { DayNight } from "./DayNight";
import { CUT_SECONDS, carriedTree, cutTree, nearbyTimber, pickTimber, dropTimber, timberOwner } from "./timber";
import { defaultTools, heldTool, nextFreeTool, returnTool, takeTool, type Tool, type ToolKind } from "./tools";
import { Shed, HeldTool, ToolControls } from "./Tools";
import { DOOR, EYE, HOUSE, SPEED, WINDOW, growth, inPond, ponds, DIG_REACH, step, createTrees, attractTrees, treePose, treeAhead, explodeTree, fillHole, digHole, digTunnel, recoverTrees, TUNNEL_HEIGHT, tunnelWidth, tunnelFurnishings, type Tunnel, type FallingTree, type Body } from "./world";

declare global {
  interface Window {
    __game?: {
      dig: (x: number, z: number) => void;
      fill: (x: number, z: number) => void;
      tunnel: (dirX: number, dirZ: number) => void;
      sim: (seconds: number) => void;
      sky: (seconds: number | null) => void;
      view?: (x: number, z: number, targetX: number, targetZ: number) => void;
      avatars?: () => unknown[];
      camera?: () => { thirdPerson: boolean; x: number; y: number; z: number; yaw: number; pitch: number };
      tool?: (kind?: ToolKind) => void;
      readonly state: { player: Body; carrying: number; tool: string | null; tools: Tool[]; players: Peer["pose"][]; holes: Hole[]; tunnels: Tunnel[]; furnishings: ReturnType<typeof tunnelFurnishings>; trees: (ReturnType<typeof treePose> & { buried: boolean; destroyed: boolean; cut: boolean; timber: FallingTree["timber"] })[] };
    };
  }
}

function canvasTex(draw: (c: CanvasRenderingContext2D) => void, repeat: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const context = cv.getContext("2d");
  if (context) draw(context);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(repeat, repeat);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function useTextures() {
  return useMemo(() => {
    const grass = canvasTex((c) => {
      c.fillStyle = "#5f8f3e"; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3000; i++) { c.fillStyle = ["#6fa04a", "#4e7c33", "#7fae55"][i % 3] ?? "#6fa04a"; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 4); }
    }, 160);
    const wood = canvasTex((c) => {
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#a8774a" : "#9a6a40"; c.fillRect(0, i * 32, 256, 32); c.fillStyle = "#6b4526"; c.fillRect(0, i * 32, 256, 2); }
    }, 3);
    const plank = canvasTex((c) => {
      c.fillStyle = "#c98a52"; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) { c.fillStyle = "#8a5730"; c.fillRect(0, i * 32, 256, 3); }
    }, 2);
    const tile = canvasTex((c) => {
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? "#e8e2d4" : "#3d5a6c"; c.fillRect(x * 64, y * 64, 64, 64); }
    }, 2);
    return { grass, wood, plank, tile };
  }, []);
}

type V3 = [number, number, number];
function B({ p, s, c, map, ...rest }: { p: V3; s: V3; c?: string; map?: THREE.Texture; transparent?: boolean; opacity?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c ?? "#fff"} map={map ?? null} {...rest} />
    </mesh>
  );
}

function House() {
  const { wood, plank, tile } = useTextures();
  const { x1, x2, z1, z2, h, t } = HOUSE;
  const w = x2 - x1, d = z2 - z1, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const wall = "#e9d9bf";
  return (
    <group>
      {/* floors */}
      <B p={[cx - 1, 0.01, cz]} s={[w - 2, 0.02, d]} map={plank} />
      <B p={[x2 - 1, 0.01, cz]} s={[2, 0.02, d]} map={tile} />
      <B p={[x1 + 2.2, 0.015, -9.5]} s={[2.2, 0.02, 3]} map={tile} />
      {/* back + right walls */}
      <B p={[cx, h / 2, z1 + t / 2]} s={[w, h, t]} map={wood} c={wall} />
      <B p={[x2 - t / 2, h / 2, cz]} s={[t, h, d]} map={wood} c={wall} />
      {/* front wall with door */}
      <B p={[(x1 + DOOR.x1) / 2, h / 2, z2 - t / 2]} s={[DOOR.x1 - x1, h, t]} map={wood} c={wall} />
      <B p={[(x2 + DOOR.x2) / 2, h / 2, z2 - t / 2]} s={[x2 - DOOR.x2, h, t]} map={wood} c={wall} />
      <B p={[0, (h + DOOR.h) / 2, z2 - t / 2]} s={[DOOR.x2 - DOOR.x1, h - DOOR.h, t]} map={wood} c={wall} />
      {/* open door leaf */}
      <B p={[DOOR.x2 + 0.05, DOOR.h / 2, z2 + 0.55]} s={[0.06, DOOR.h, 1.1]} c="#7a3b22" />
      {/* left wall with window */}
      <B p={[x1 + t / 2, h / 2, (z1 + WINDOW.z1) / 2]} s={[t, h, WINDOW.z1 - z1]} map={wood} c={wall} />
      <B p={[x1 + t / 2, h / 2, (z2 + WINDOW.z2) / 2]} s={[t, h, z2 - WINDOW.z2]} map={wood} c={wall} />
      <B p={[x1 + t / 2, WINDOW.y1 / 2, -8]} s={[t, WINDOW.y1, 2]} map={wood} c={wall} />
      <B p={[x1 + t / 2, (h + WINDOW.y2) / 2, -8]} s={[t, h - WINDOW.y2, 2]} map={wood} c={wall} />
      <mesh position={[x1 + t / 2, (WINDOW.y1 + WINDOW.y2) / 2, -8]}>
        <boxGeometry args={[0.03, WINDOW.y2 - WINDOW.y1, 2]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.25} roughness={0} />
      </mesh>
      <B p={[x1 + t / 2, 1.55, -8]} s={[0.08, 0.06, 2]} c="#f4f1ea" />
      <B p={[x1 + t / 2, 1.55, -8]} s={[0.08, 1.1, 0.06]} c="#f4f1ea" />
      <B p={[x1 + 0.3, WINDOW.y1, -8]} s={[0.25, 0.06, 2.2]} c="#f4f1ea" />
      {/* ceiling + roof */}
      <B p={[cx, h + 0.05, cz]} s={[w, 0.1, d]} c="#f2ead8" />
      <mesh position={[cx, h + 1.1, cz]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.hypot(w, d) / 2 + 0.4, 2.2, 4]} />
        <meshStandardMaterial color="#a33a2a" flatShading />
      </mesh>
      {/* living: sofa */}
      <B p={[-2.7, 0.25, -6.2]} s={[2, 0.5, 0.8]} c="#3f6e8c" />
      <B p={[-2.7, 0.7, -5.9]} s={[2, 0.5, 0.2]} c="#36607a" />
      <B p={[-2.7, 0.2, -7.2]} s={[1.0, 0.4, 0.6]} c="#6b4526" />
      <B p={[-2.7, 0.012, -6.9]} s={[2.4, 0.01, 1.8]} c="#c46a4a" />
      {/* dining table + chairs */}
      <B p={[-2.4, 0.75, -8.5]} s={[1.6, 0.06, 0.8]} c="#8a5730" />
      {([[-3.1, -8.8], [-1.7, -8.8], [-3.1, -8.2], [-1.7, -8.2]] as [number, number][]).map(([x, z], i) => <B key={i} p={[x, 0.37, z]} s={[0.06, 0.74, 0.06]} c="#6b4526" />)}
      {([[-2.8, -9.2], [-2.0, -9.2], [-2.8, -7.8], [-2.0, -7.8]] as [number, number][]).map(([x, z], i) => (
        <group key={i}>
          <B p={[x, 0.45, z]} s={[0.45, 0.05, 0.45]} c="#b5804f" />
          <B p={[x, 0.22, z]} s={[0.35, 0.44, 0.35]} c="#9a6a40" />
        </group>
      ))}
      <mesh position={[-2.4, 0.88, -8.5]}><cylinderGeometry args={[0.08, 0.06, 0.2]} /><meshStandardMaterial color="#e6d4ff" /></mesh>
      {/* cabinet + lamp */}
      <B p={[3.1, 0.45, -5.75]} s={[1.4, 0.9, 0.6]} c="#7a4e2d" />
      <mesh position={[3.1, 1.15, -5.75]}><cylinderGeometry args={[0.15, 0.25, 0.4]} /><meshStandardMaterial color="#ffe6b0" emissive="#ffcc77" emissiveIntensity={0.6} /></mesh>
      {/* kitchen */}
      <B p={[2.2, 0.45, -10.5]} s={[3.2, 0.9, 0.6]} c="#f3efe6" />
      <B p={[2.2, 0.92, -10.5]} s={[3.2, 0.05, 0.62]} c="#4a4a4a" />
      <B p={[3.5, 0.45, -9.4]} s={[0.6, 0.9, 1.6]} c="#f3efe6" />
      <B p={[3.5, 0.92, -9.4]} s={[0.62, 0.05, 1.6]} c="#4a4a4a" />
      {/* sink */}
      <B p={[1.4, 0.93, -10.5]} s={[0.6, 0.04, 0.4]} c="#b8c2c8" />
      <B p={[1.4, 1.1, -10.75]} s={[0.04, 0.3, 0.04]} c="#b8c2c8" />
      {/* stove */}
      <B p={[2.6, 0.95, -10.5]} s={[0.7, 0.02, 0.5]} c="#222" />
      {([[2.45, -10.4], [2.75, -10.4], [2.45, -10.62], [2.75, -10.62]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.97, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.05, 0.08, 20]} /><meshStandardMaterial color="#c33" emissive="#a22" /></mesh>
      ))}
      <B p={[2.2, 2.1, -10.62]} s={[3.2, 0.7, 0.35]} c="#d9cfbd" />
      {/* fridge */}
      <B p={[3.5, 1.0, -8.2]} s={[0.6, 2.0, 0.6]} c="#dfe6ea" />
      <B p={[3.18, 1.3, -8.05]} s={[0.03, 0.4, 0.04]} c="#888" />
      <pointLight position={[0, 2.6, -8]} intensity={6} distance={10} color="#ffd9a0" />
    </group>
  );
}

function Tree() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.15, 0.22, 1.6]} /><meshStandardMaterial color="#6b4526" /></mesh>
      <mesh position={[0, 2.2, 0]} castShadow><coneGeometry args={[1, 2.2, 7]} /><meshStandardMaterial color="#2f6b3a" flatShading /></mesh>
      <mesh position={[0, 3.1, 0]} castShadow><coneGeometry args={[0.7, 1.6, 7]} /><meshStandardMaterial color="#3a7d45" flatShading /></mesh>
    </group>
  );
}

function Ponds() {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.opacity = 0.8 + Math.sin(clock.elapsedTime * 1.5) * 0.05;
  });
  return (
    <>
      {ponds.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
            <circleGeometry args={[p.r + 0.4, 40]} />
            <meshStandardMaterial color="#8a7a5a" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <circleGeometry args={[p.r, 40]} />
            <meshStandardMaterial ref={i === 0 ? water : null} color="#3f86a8" roughness={0.05} metalness={0.3} transparent opacity={0.85} />
          </mesh>
          {[0, 1, 2].map((j) => (
            <mesh key={j} rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(j * 2.1 + i) * p.r * 0.5, 0.05, Math.sin(j * 2.1 + i) * p.r * 0.5]}>
              <circleGeometry args={[0.25, 12]} />
              <meshStandardMaterial color="#4f9a46" />
            </mesh>
          ))}
          {Array.from({ length: 8 }, (_, j) => {
            const a = j * 0.8 + i;
            return (
              <mesh key={j} position={[Math.cos(a) * (p.r + 0.3), 0.4, Math.sin(a) * (p.r + 0.3)]}>
                <cylinderGeometry args={[0.03, 0.03, 0.8]} />
                <meshStandardMaterial color="#5d7a2e" />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

const FLOWER_COLORS = ["#e8546a", "#f2c84b", "#f4f1ea", "#b07ad6", "#ff8c42"];

/** The world develops: trees grow from saplings, new trees and flowers keep appearing. */
function Growth({ holes, trees, time, advance }: { holes: React.RefObject<Hole[]>; trees: React.RefObject<FallingTree[]>; time: React.RefObject<number>; advance: React.RefObject<(seconds: number) => void> }) {
  const items = useMemo(() => {
    const flowers: { x: number; z: number; c: string; birth: number }[] = [];
    for (let i = 0; i < 160 && flowers.length < 120; i++) {
      const a = i * 1.7, rr = 4 + ((i * 11) % 26);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (inPond(x, z, 0.5) || (x > -5 && x < 5 && z > -12 && z < 4)) continue;
      flowers.push({ x, z, c: FLOWER_COLORS[i % FLOWER_COLORS.length] ?? "#e8546a", birth: i * 1.2 });
    }
    return { flowers };
  }, []);
  const treeRefs = useRef<(THREE.Group | null)[]>([]);
  const flowerRefs = useRef<(THREE.Group | null)[]>([]);
  // Restored pits have already attracted trees; reopening must not pull a fresh tree into each old pit.
  const seen = useRef(new Map(holes.current.map((h) => [h.id, `${h.r}:${h.d}`])));
  const tick = useCallback((seconds: number) => {
    for (const h of holes.current) {
      const signature = `${h.r}:${h.d}`;
      if (seen.current.get(h.id) !== signature) {
        attractTrees(trees.current, h, time.current, !seen.current.has(h.id));
        seen.current.set(h.id, signature);
      }
    }
    time.current += seconds;
    const t = time.current;
    trees.current.forEach((tr, i) => {
      const g = treeRefs.current[i];
      if (g) {
        g.visible = !tr.buried && !tr.destroyed && (tr.cutAt === undefined || t < tr.cutAt + CUT_SECONDS);
        const pose = treePose(tr, t);
        g.position.set(pose.x, pose.y, pose.z);
        g.rotation.set(pose.tilt * Math.cos(pose.heading), 0, -pose.tilt * Math.sin(pose.heading));
        if (tr.cutAt !== undefined) g.rotation.z = -Math.PI / 2 * growth(t, tr.cutAt, CUT_SECONDS);
        g.scale.setScalar(tr.s * Math.max(0.001, 0.15 + 0.85 * growth(t, tr.birth)));
      }
    });
    items.flowers.forEach((f, i) => {
      const g = flowerRefs.current[i];
      if (g) g.scale.setScalar(Math.max(0.001, growth(t, f.birth, 5)));
    });
  }, [holes, trees, time, items]);
  useEffect(() => { advance.current = tick; }, [advance, tick]);
  useFrame((_, delta) => tick(Math.min(delta, 0.05)));
  return (
    <>
      {trees.current.map((tr, i) => (
        <group key={i} position={[tr.x, 0, tr.z]} ref={(el) => { treeRefs.current[i] = el; }}>
          <Tree />
        </group>
      ))}
      {items.flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]} ref={(el) => { flowerRefs.current[i] = el; }}>
          <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.015, 0.015, 0.3]} /><meshStandardMaterial color="#4e7c33" /></mesh>
          <mesh position={[0, 0.32, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color={f.c} /></mesh>
        </group>
      ))}
    </>
  );
}

function Player({ onDig, onFill, onTunnel, onSaw, onCarry, onTool, direction, holes, tunnels, pos, advance, thirdPerson, carrying, tool, ownerKey }: { onDig: (x: number, z: number) => void; onFill: (x: number, z: number) => void; onTunnel: (x: number, z: number) => void; onSaw: (x: number, z: number) => void; onCarry: () => void; onTool: () => void; direction: React.RefObject<{ x: number; z: number }>; holes: React.RefObject<Hole[]>; tunnels: React.RefObject<Tunnel[]>; pos: React.RefObject<Body>; advance: React.RefObject<(dt: number) => void>; thirdPerson: React.RefObject<boolean>; carrying: React.RefObject<number>; tool: React.RefObject<Tool[]>; ownerKey: React.RefObject<string> }) {
  const { camera, scene } = useThree();
  const self = useRef(new Map<string, Peer>());
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const backward = useMemo(() => new THREE.Vector3(), []);
  const keys = useRef<Record<string, boolean>>({});
  const earth = useRef<THREE.Mesh>(null);
  const lantern = useRef<THREE.PointLight>(null);
  const { wood } = useTextures();
  useEffect(() => {
    camera.position.set(pos.current.x, pos.current.y + EYE, pos.current.z);
    camera.lookAt(pos.current.x, pos.current.y + EYE, pos.current.z - 14);
    if (import.meta.env.DEV && window.__game) window.__game.view = (x, z, targetX, targetZ) => {
      pos.current = { x, y: 0, z, vy: 0 };
      camera.position.set(x, EYE, z);
      camera.lookAt(targetX, 0, targetZ);
    };
    if (import.meta.env.DEV && window.__game) window.__game.camera = () => ({ thirdPerson: thirdPerson.current, x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: camera.rotation.y, pitch: camera.rotation.x });
    const d = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      keys.current[e.code] = true;
      if (e.code === "KeyG" && !e.repeat) onTool();
      if (["KeyE", "KeyF", "KeyT", "KeyV", "KeyR"].includes(e.code) && !e.repeat) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const x = pos.current.x + dir.x * DIG_REACH, z = pos.current.z + dir.z * DIG_REACH;
        if (e.code === "KeyT") onTunnel(dir.x, dir.z);
        else if (e.code === "KeyV") onSaw(dir.x, dir.z);
        else if (e.code === "KeyR") onCarry();
        else if (e.code === "KeyE") {
          const inside = pos.current.y < 0 && holes.current.some((h) => Math.hypot(h.x - pos.current.x, h.z - pos.current.z) < h.r);
          onDig(inside ? pos.current.x : x, inside ? pos.current.z : z);
        }
        else {
          const ahead = holes.current.some((h) => Math.hypot(h.x - x, h.z - z) <= h.r + 0.2);
          onFill(ahead ? x : pos.current.x, ahead ? z : pos.current.z);
        }
      }
    };
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const reset = () => { keys.current = {}; };
    window.addEventListener("keydown", d); window.addEventListener("keyup", u); window.addEventListener("blur", reset);
    document.addEventListener("pointerlockchange", reset);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); window.removeEventListener("blur", reset); document.removeEventListener("pointerlockchange", reset); };
  }, [camera, onDig, onFill, onTunnel, onSaw, onCarry, onTool, holes, pos]);
  const f = new THREE.Vector3(), r = new THREE.Vector3();
  const tick = (dt: number) => {
    const k = keys.current;
    const fw = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const st = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    camera.getWorldDirection(f); f.y = 0; f.normalize();
    direction.current.x = f.x; direction.current.z = f.z;
    r.crossVectors(f, camera.up).normalize();
    const mx = (f.x * fw + r.x * st) * SPEED * dt, mz = (f.z * fw + r.z * st) * SPEED * dt;
    pos.current = step(pos.current, mx, mz, !!k["Space"], holes.current, dt, tunnels.current);
    if (thirdPerson.current && !pos.current.buried) {
      camera.getWorldDirection(backward);
      origin.set(pos.current.x, pos.current.y + EYE + 0.25, pos.current.z);
      backward.negate();
      ray.set(origin, backward);
      ray.far = CHASE_DISTANCE;
      const obstacles = ray.intersectObjects(scene.children, true).filter((hit) => {
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          if (!object.visible || object.name === "local-player" || object.name.startsWith("remote-player-") || object.name === "carried-timber") return false;
          object = object.parent;
        }
        if (!(hit.object instanceof THREE.Mesh)) return false;
        const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
        return materials.some((material) => material.visible && material.depthWrite && !material.transparent);
      });
      const distance = obstacles[0] ? Math.max(0, obstacles[0].distance - 0.2) : CHASE_DISTANCE;
      const position = chasePosition(pos.current, { x: -backward.x, y: -backward.y, z: -backward.z }, distance);
      camera.position.set(position.x, position.y, position.z);
    } else camera.position.set(pos.current.x, pos.current.y + EYE, pos.current.z);
    self.current.set("self", { received: performance.now(), pose: { id: "self", seq: 0, x: pos.current.x, y: pos.current.y, z: pos.current.z, yaw: Math.atan2(-f.x, -f.z), pitch: camera.rotation.x, moving: fw !== 0 || st !== 0, buried: !thirdPerson.current || !!pos.current.buried || camera.position.distanceTo(origin) < 0.65, carrying: carrying.current >= 0, tool: heldTool(tool.current, ownerKey.current) } });
    if (lantern.current) lantern.current.position.set(pos.current.x, pos.current.y + EYE, pos.current.z);
    if (earth.current) {
      earth.current.visible = !!pos.current.buried;
      earth.current.position.copy(camera.position);
    }
  };
  advance.current = tick;
  useFrame((_, delta) => tick(Math.min(delta, 0.05)));
  return <><Avatar id="self" peers={self} local /><pointLight ref={lantern} intensity={7} distance={9} decay={1.5} /><mesh ref={earth} visible={false} renderOrder={1000}>
    <sphereGeometry args={[0.3, 16, 12]} />
    <meshBasicMaterial map={wood} color="#5a3b22" side={THREE.BackSide} depthTest={false} depthWrite={false} />
  </mesh></>;
}

type Hole = { x: number; z: number; r: number; d: number; id: number };
const holeMask = new THREE.MeshBasicMaterial({
  colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
});
function Holes({ holes, tunnels }: { holes: Hole[]; tunnels: Tunnel[] }) {
  const soil = useMemo(() => canvasTex((c) => {
    c.fillStyle = "#6b4a2b"; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) {
      c.fillStyle = ["#5a3b22", "#7a5533", "#8a7a5a"][i % 3] ?? "#5a3b22";
      c.fillRect(Math.random() * 256, Math.random() * 256, 2 + i % 4, 2);
    }
  }, 1), []);
  useEffect(() => () => soil.dispose(), [soil]);
  const geometry = useMemo(() => {
    if (!tunnels.length) return null;
    const size = 0.25;
    const levels = [...new Set([0, ...holes.map((h) => -h.d), ...tunnels.flatMap((t) => [t.floor, t.floor + TUNNEL_HEIGHT])])].sort((a, b) => a - b);
    const cells = new Set<string>();
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const regions = [...holes.map((h) => ({ x: h.x, z: h.z, r: h.r })), ...tunnels.map((t) => ({ x: t.x, z: t.z, r: tunnelWidth(t) / 2 }))];
    for (const region of regions) for (let ix = Math.floor((region.x - region.r) / size); ix <= Math.ceil((region.x + region.r) / size); ix++) for (let iz = Math.floor((region.z - region.r) / size); iz <= Math.ceil((region.z + region.r) / size); iz++) {
      const x = (ix + 0.5) * size, z = (iz + 0.5) * size;
      for (let iy = 0; iy < levels.length - 1; iy++) {
        const y = ((levels[iy] ?? 0) + (levels[iy + 1] ?? 0)) / 2;
        if (holes.some((h) => y < 0 && y > -h.d && Math.hypot(x - h.x, z - h.z) < h.r) || tunnels.some((t) => y > t.floor && y < t.floor + TUNNEL_HEIGHT && Math.abs(x - t.x) <= tunnelWidth(t) / 2 && Math.abs(z - t.z) <= tunnelWidth(t) / 2)) cells.add(key(ix, iy, iz));
      }
    }
    const vertices: number[] = [], uv: number[] = [];
    const face = (a: V3, b: V3, c: V3, d: V3) => { for (const v of [a, b, c, a, c, d]) { vertices.push(...v); uv.push(v[0] + v[2], v[1] + v[2]); } };
    for (const cell of cells) {
      const [ix = 0, iy = 0, iz = 0] = cell.split(",").map(Number);
      const x = ix * size, z = iz * size, y = levels[iy] ?? 0, top = levels[iy + 1] ?? 0, right = x + size, back = z + size;
      if (!cells.has(key(ix - 1, iy, iz))) face([x,y,z],[x,top,z],[x,top,back],[x,y,back]);
      if (!cells.has(key(ix + 1, iy, iz))) face([right,y,z],[right,y,back],[right,top,back],[right,top,z]);
      if (!cells.has(key(ix, iy, iz - 1))) face([x,y,z],[right,y,z],[right,top,z],[x,top,z]);
      if (!cells.has(key(ix, iy, iz + 1))) face([x,y,back],[x,top,back],[right,top,back],[right,y,back]);
      if (!cells.has(key(ix, iy - 1, iz))) face([x,y,z],[x,y,back],[right,y,back],[right,y,z]);
      if (top < 0 && !cells.has(key(ix, iy + 1, iz))) face([x,top,z],[right,top,z],[right,top,back],[x,top,back]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, [holes, tunnels]);
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  return (
    <>
      {geometry && <mesh geometry={geometry}><meshStandardMaterial map={soil} side={THREE.DoubleSide} /></mesh>}
      {holes.map((h) => (
        <group key={h.id} position={[h.x, 0, h.z]}>
          {/* cuts the grass so you can see down into the hole */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={holeMask} renderOrder={-1}>
            <circleGeometry args={[h.r, 32]} />
          </mesh>
          {!geometry && <mesh position={[0, -h.d / 2, 0]}>
            <cylinderGeometry args={[h.r, h.r * 0.9, h.d, 32, 1, true]} />
            <meshStandardMaterial color="#5a3b22" side={THREE.BackSide} />
          </mesh>}
          {!geometry && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h.d + 0.01, 0]}>
            <circleGeometry args={[h.r * 0.9, 32]} />
            <meshStandardMaterial color="#3a2614" />
          </mesh>}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[h.r * 0.96, h.r + 0.25, 32]} />
            <meshStandardMaterial color="#6b4a2b" />
          </mesh>
          <mesh position={[h.r + 0.45, 0.12, 0]} castShadow>
            <sphereGeometry args={[0.3, 8, 6]} />
            <meshStandardMaterial color="#7a5533" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

function TunnelFurniture({ tunnels }: { tunnels: Tunnel[] }) {
  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--game-tunnel-${name}`).trim();
    return { wood: token("wood"), cabinet: token("cabinet"), metal: token("metal"), dark: token("dark"), ceramic: token("ceramic"), lamp: token("lamp") };
  }, []);
  return <>{tunnelFurnishings(tunnels).map((room) => <group key={room.shaft} position={[room.x, room.floor, room.z]} name="tunnel-furnished-room">
    <group name="table">
      <B p={[-1.3, 0.76, -1.65]} s={[1.2, 0.08, 0.7]} c={colors.wood} />
      {[-1.8, -0.8].flatMap((x) => [-1.9, -1.4].map((z) => <B key={`${x}:${z}`} p={[x, 0.36, z]} s={[0.07, 0.72, 0.07]} c={colors.wood} />))}
    </group>
    {[-1.85, -0.85].map((x) => <group key={x} name="chair">
      <B p={[x, 0.45, -0.9]} s={[0.4, 0.06, 0.4]} c={colors.wood} />
      <B p={[x, 0.72, -0.72]} s={[0.4, 0.5, 0.06]} c={colors.cabinet} />
      {[-0.15, 0.15].flatMap((dx) => [-1.05, -0.75].map((z) => <B key={`${dx}:${z}`} p={[x + dx, 0.22, z]} s={[0.05, 0.44, 0.05]} c={colors.wood} />))}
    </group>)}
    <group name="kitchen">
      <B p={[-0.65, 0.45, 1.95]} s={[2.5, 0.9, 0.6]} c={colors.cabinet} />
      <B p={[-0.65, 0.92, 1.95]} s={[2.5, 0.06, 0.62]} c={colors.wood} />
      {[-1.5, -0.7, 0.1].map((x) => <B key={x} p={[x, 0.5, 1.635]} s={[0.25, 0.04, 0.04]} c={colors.metal} />)}
      <B p={[-1.25, 0.96, 1.95]} s={[0.6, 0.04, 0.4]} c={colors.metal} />
      <B p={[-1.25, 1.1, 2.12]} s={[0.04, 0.28, 0.04]} c={colors.metal} />
      <B p={[-1.25, 1.23, 2.04]} s={[0.04, 0.04, 0.2]} c={colors.metal} />
      <B p={[0, 0.96, 1.95]} s={[0.65, 0.02, 0.45]} c={colors.dark} />
      {[-0.16, 0.16].flatMap((x) => [1.84, 2.06].map((z) => <mesh key={`${x}:${z}`} position={[x, 0.98, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.055, 0.08, 16]} /><meshStandardMaterial color={colors.metal} /></mesh>))}
      <B p={[0, 0.45, 1.63]} s={[0.55, 0.4, 0.02]} c={colors.dark} />
    </group>
    <group name="toilet" position={[1.55, 0, 1.75]}>
      <B p={[0, 0.66, 0.3]} s={[0.55, 0.62, 0.22]} c={colors.ceramic} />
      <mesh position={[0, 0.23, 0]}><cylinderGeometry args={[0.23, 0.16, 0.46, 20]} /><meshStandardMaterial color={colors.ceramic} /></mesh>
      <mesh position={[0, 0.49, -0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]}><torusGeometry args={[0.23, 0.06, 8, 24]} /><meshStandardMaterial color={colors.ceramic} /></mesh>
      <B p={[0.15, 0.95, 0.3]} s={[0.09, 0.025, 0.07]} c={colors.metal} />
    </group>
    <mesh position={[0, 2.05, 0]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color={colors.lamp} emissive={colors.lamp} emissiveIntensity={1} /></mesh>
    <pointLight position={[0, 1.95, 0]} color={colors.lamp} intensity={12} distance={7} decay={1.5} />
  </group>)}</>;
}

/** Distant hills; all visible forest trees are interactive Growth trees. */
function Horizon() {
  const hills = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.13;
    const rr = 300 + ((i * 37) % 120);
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, s: 60 + ((i * 23) % 50), h: 14 + ((i * 17) % 12) };
  }), []);
  return (
    <>
      {hills.map((hl, i) => (
        <mesh key={`h${i}`} position={[hl.x, 0, hl.z]}>
          <coneGeometry args={[hl.s, hl.h, 7]} />
          <meshStandardMaterial color={i % 2 ? "#4e7c33" : "#5f8f3e"} flatShading />
        </mesh>
      ))}
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const n = useRef(0);
  useFrame(() => { if (++n.current === 2) onReady(); });
  return null;
}

function MouseLook({ playing }: { playing: boolean }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    let dragging = false;
    const down = () => {
      dragging = true;
      if (playing && document.pointerLockElement !== gl.domElement) {
        try { void gl.domElement.requestPointerLock()?.catch(() => {}); } catch { /* Drag-to-look remains available. */ }
      }
    };
    const up = () => { dragging = false; };
    const look = (event: MouseEvent) => {
      if (!playing || (document.pointerLockElement !== gl.domElement && !dragging)) return;
      camera.rotation.order = "YXZ";
      camera.rotation.y -= event.movementX * 0.002;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, camera.rotation.x - event.movementY * 0.002));
    };
    gl.domElement.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", look);
    return () => {
      gl.domElement.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", look);
    };
  }, [camera, gl, playing]);
  return null;
}

export default function World() {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Загрузка мира…");
  const [locked, setLocked] = useState(false);
  const [thirdPerson, setThirdPerson] = useState(false);
  const thirdPersonRef = useRef(false);
  const [holes, setHoles] = useState<Hole[]>([]);
  const holesRef = useRef<Hole[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const tunnelsRef = useRef<Tunnel[]>([]);
  const treesRef = useRef(createTrees());
  const timeRef = useRef(0);
  const skyOverrideRef = useRef<number | null>(null);
  const advanceRef = useRef<(seconds: number) => void>(() => {});
  const playerRef = useRef<Body>({ x: 0, y: 0, z: 6, vy: 0 });
  const directionRef = useRef({ x: 0, z: -1 });
  const ownerRef = useRef("");
  const carryingRef = useRef(-1);
  const toolsRef = useRef<Tool[]>(defaultTools());
  const peersRef = useRef(new Map<string, Peer>());
  const playerAdvanceRef = useRef<(dt: number) => void>(() => {});
  const saveRef = useRef<(edit?: WorldEdit) => void>(() => {});
  const editsRef = useRef<WorldEdit[]>([]);
  const connectedRef = useRef(false);
  useEffect(() => {
    let active = true;
    let busy = false;
    let revision = 0;
    let seenRevision = -1;
    let canonical = snapshot([], [], createTrees(), playerRef.current, 0);
    try { ownerRef.current = timberOwner(localStorage); } catch { ownerRef.current = crypto.randomUUID(); }
    try {
      const stored = JSON.parse(localStorage.getItem("forest-shared-player") ?? "null");
      const parsed = sharedSave(canonical, stored);
      if (parsed) playerRef.current = parsed.player;
    } catch { /* Keep the safe spawn. */ }
    const display = () => {
      const visible = editsRef.current.reduce(applyWorldEdit, canonical);
      if (visible.holes !== holesRef.current) { holesRef.current = visible.holes; setHoles(visible.holes); }
      if (visible.tunnels !== tunnelsRef.current) { tunnelsRef.current = visible.tunnels; setTunnels(visible.tunnels); }
      treesRef.current = visible.trees;
      toolsRef.current = visible.tools ?? defaultTools();
      carryingRef.current = carriedTree(visible.trees, ownerRef.current);
      timeRef.current = Math.max(timeRef.current, visible.time);
      advanceRef.current(0);
    };
    const sync = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        for (let attempt = 0; attempt < 5 && active; attempt++) {
          const { data, error } = await supabase.from("shared_forest_world").select("snapshot,revision").eq("id", 1).maybeSingle();
          if (error) throw error;
          if (!active) return;
          revision = data?.revision ?? 0;
          const batch = [...editsRef.current];
          // Nothing new from other players and nothing of ours to save: skip the redraw so walking stays smooth.
          if (data && revision === seenRevision && batch.length === 0) break;
          const saved = data ? sharedSave(data.snapshot, playerRef.current) : canonical;
          if (!saved) throw new Error("Invalid common world");
          canonical = saved;
          seenRevision = revision;
          if (batch.length || !data) {
            const next = batch.reduce(applyWorldEdit, canonical);
            next.time = Math.max(next.time, timeRef.current);
            const { data: accepted, error: failure } = await supabase.rpc("commit_shared_forest", { expected_revision: revision, world_snapshot: next });
            if (failure) throw failure;
            if (!accepted) continue;
            editsRef.current.splice(0, batch.length);
            canonical = next;
            seenRevision = revision + 1;
          }
          if (active) {
            display();
            connectedRef.current = true;
            setSaveStatus(editsRef.current.length ? "Сохраняем изменения…" : "Общий мир · подключён");
            setLoaded(true);
          }
          if (!editsRef.current.length) break;
        }
      } catch {
        if (active) setSaveStatus("Нет связи с общим миром · повторяем подключение…");
      } finally { busy = false; }
    };
    saveRef.current = (edit) => {
      try { localStorage.setItem("forest-shared-player", JSON.stringify(playerRef.current)); } catch { /* Cloud world does not depend on local storage. */ }
      if (edit) editsRef.current.push(edit);
      void sync();
    };
    void sync();
    const timer = setInterval(() => saveRef.current(), 1500);
    const leave = () => {
      // A held tool goes back to the shelf when the game closes, so it never stays locked.
      const held = heldTool(toolsRef.current, ownerRef.current);
      if (held) {
        toolsRef.current = returnTool(toolsRef.current, ownerRef.current);
        editsRef.current.push({ kind: "return-tool", x: 0, z: 0, id: 0, time: timeRef.current, player: { ...playerRef.current }, owner: ownerRef.current, tool: held });
      }
      saveRef.current();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      saveRef.current = () => {};
    };
  }, []);
  const onDig = useCallback((x: number, z: number) => {
    if (!connectedRef.current || heldTool(toolsRef.current, ownerRef.current) !== "shovel") return;
    const id = Date.now() + Math.random();
    const next = digHole(holesRef.current, x, z, id);
    for (const pit of next) recoverTrees(treesRef.current, pit, timeRef.current);
    holesRef.current = next;
    setHoles(next);
    advanceRef.current(0);
    saveRef.current({ kind: "dig", x, z, id, time: timeRef.current, player: { ...playerRef.current } });
  }, []);
  const onTunnel = useCallback((x: number, z: number) => {
    if (!connectedRef.current) return;
    if (playerRef.current.y >= -0.05) {
      if (heldTool(toolsRef.current, ownerRef.current) !== "weapon") return;
      const index = treeAhead(treesRef.current, playerRef.current, x, z, timeRef.current);
      if (index < 0) return;
      treesRef.current = explodeTree(treesRef.current, index, timeRef.current);
      advanceRef.current(0);
      saveRef.current({ kind: "blast", x, z, id: index, time: timeRef.current, player: { ...playerRef.current } });
      return;
    }
    const next = digTunnel(holesRef.current, tunnelsRef.current, playerRef.current, x, z);
    tunnelsRef.current = next;
    setTunnels(next);
    saveRef.current({ kind: "tunnel", x, z, id: 0, time: timeRef.current, player: { ...playerRef.current } });
  }, []);
  const onFill = useCallback((x: number, z: number) => {
    if (!connectedRef.current || heldTool(toolsRef.current, ownerRef.current) !== "broom") return;
    const result = fillHole(holesRef.current, treesRef.current, x, z, playerRef.current);
    if (result.player) playerRef.current = result.player;
    holesRef.current = result.holes;
    treesRef.current = result.trees;
    setHoles(result.holes);
    advanceRef.current(0);
    saveRef.current({ kind: "fill", x, z, id: 0, time: timeRef.current, player: { ...playerRef.current } });
  }, []);
  const onSaw = useCallback((x: number, z: number) => {
    if (!connectedRef.current || carryingRef.current >= 0) return;
    const index = treeAhead(treesRef.current, playerRef.current, x, z, timeRef.current);
    if (index < 0) return;
    treesRef.current = cutTree(treesRef.current, index, timeRef.current);
    advanceRef.current(0);
    saveRef.current({ kind: "cut", x, z, id: index, time: timeRef.current, player: { ...playerRef.current } });
  }, []);
  const onCarry = useCallback(() => {
    if (!connectedRef.current || playerRef.current.buried) return;
    const held = carryingRef.current;
    const index = held >= 0 ? held : nearbyTimber(treesRef.current, playerRef.current, timeRef.current);
    if (index < 0) return;
    const next = held >= 0 ? dropTimber(treesRef.current, index, playerRef.current, ownerRef.current) : pickTimber(treesRef.current, index, playerRef.current, ownerRef.current, timeRef.current);
    if (next === treesRef.current) return;
    treesRef.current = next;
    carryingRef.current = carriedTree(next, ownerRef.current);
    saveRef.current({ kind: held >= 0 ? "drop" : "pickup", x: 0, z: 0, id: index, time: timeRef.current, player: { ...playerRef.current }, owner: ownerRef.current });
  }, []);
  const onTool = useCallback((kind?: ToolKind) => {
    if (!connectedRef.current) return;
    const held = heldTool(toolsRef.current, ownerRef.current);
    if (held) {
      toolsRef.current = returnTool(toolsRef.current, ownerRef.current);
      saveRef.current({ kind: "return-tool", x: 0, z: 0, id: 0, time: timeRef.current, player: { ...playerRef.current }, owner: ownerRef.current, tool: held });
      return;
    }
    kind ??= nextFreeTool(toolsRef.current, playerRef.current, ownerRef.current) ?? undefined;
    if (!kind) return;
    toolsRef.current = takeTool(toolsRef.current, kind, playerRef.current, ownerRef.current);
    saveRef.current({ kind: "take-tool", x: 0, z: 0, id: 0, time: timeRef.current, player: { ...playerRef.current }, owner: ownerRef.current, tool: kind });
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const previousView = window.__game?.view;
    window.__game = {
      dig: onDig,
      fill: onFill,
      tunnel: onTunnel,
      tool: onTool,
      sky: (seconds) => { skyOverrideRef.current = seconds; },
      sim: (seconds) => {
        advanceRef.current(seconds);
        for (let remaining = seconds; remaining > 0; remaining -= 1 / 60) playerAdvanceRef.current(Math.min(remaining, 1 / 60));
      },
      ...(previousView ? { view: previousView } : {}),
      get state() { return { player: { ...playerRef.current }, carrying: carryingRef.current, tool: heldTool(toolsRef.current, ownerRef.current), tools: toolsRef.current, players: [...peersRef.current.values()].map((peer) => peer.pose), holes: holesRef.current, tunnels: tunnelsRef.current, furnishings: tunnelFurnishings(tunnelsRef.current), trees: treesRef.current.map((tr) => ({ ...treePose(tr, timeRef.current), buried: !!tr.buried, destroyed: !!tr.destroyed, cut: tr.cutAt !== undefined, timber: tr.timber })) }; },
    };
    return () => { delete window.__game; };
  }, [onDig, onFill, onTunnel, onTool]);
  const { grass } = useTextures();
  useEffect(() => {
    const pause = (event: KeyboardEvent) => {
      if (event.code === "Escape") setLocked(false);
    };
    // Browsers swallow Escape while pointer lock is active; show the play button again when lock is lost.
    let hadLock = false;
    const lockChange = () => {
      if (document.pointerLockElement) hadLock = true;
      else if (hadLock) { hadLock = false; setLocked(false); }
    };
    window.addEventListener("keydown", pause);
    document.addEventListener("pointerlockchange", lockChange);
    return () => { window.removeEventListener("keydown", pause); document.removeEventListener("pointerlockchange", lockChange); };
  }, []);
  const enter = () => {
    setLocked(true);
    const canvas = document.querySelector("canvas");
    try { void canvas?.requestPointerLock()?.catch(() => {}); } catch { /* Drag-to-look remains available. */ }
  };
  return (
    <div className="game-root" data-scene-ready={ready ? "" : undefined}>
      {loaded && <Canvas shadows gl={{ stencil: true }} camera={{ fov: 70, near: 0.05, far: 600 }}>
        <DayNight override={skyOverrideRef} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1200, 1200]} />
          <meshStandardMaterial map={grass} stencilWrite stencilRef={1} stencilWriteMask={0} stencilFunc={THREE.NotEqualStencilFunc} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -1]} receiveShadow>
          <planeGeometry args={[1.4, 8]} />
          <meshStandardMaterial color="#b9a586" />
        </mesh>
        <House />
        <Shed tools={toolsRef} />
        <Ponds />
        <Horizon />
        <Growth holes={holesRef} trees={treesRef} time={timeRef} advance={advanceRef} />
        <TreeBursts trees={treesRef} time={timeRef} />
        <Timber trees={treesRef} time={timeRef} carrying={carryingRef} thirdPerson={thirdPersonRef} />
        <Player onDig={onDig} onFill={onFill} onTunnel={onTunnel} onSaw={onSaw} onCarry={onCarry} onTool={onTool} direction={directionRef} holes={holesRef} tunnels={tunnelsRef} pos={playerRef} advance={playerAdvanceRef} thirdPerson={thirdPersonRef} carrying={carryingRef} tool={toolsRef} ownerKey={ownerRef} />
        <HeldTool tools={toolsRef} owner={ownerRef} thirdPerson={thirdPersonRef} />
        <Holes holes={holes} tunnels={tunnels} />
        <TunnelFurniture tunnels={tunnels} />
        <MouseLook playing={locked} />
        <Multiplayer playing={locked} pos={playerRef} peers={peersRef} carrying={carryingRef} tools={toolsRef} owner={ownerRef} />
        <Ready onReady={() => setReady(true)} />
      </Canvas>}
      {!locked && (
        <div className="game-overlay">
          <h1>Домик в лесу</h1>
          <p role="status" className="sr-only">{saveStatus}</p>
          <Button className="game-play" onClick={enter} disabled={!ready} aria-label="Начать игру" title="Начать игру"><Play aria-hidden="true" /></Button>
        </div>
      )}
      {locked && <div className="game-crosshair" />}
      {ready && <Button className="game-tool game-camera-tool" aria-label={thirdPerson ? "Вид глазами" : "Вид от третьего лица"} title={thirdPerson ? "Вид глазами" : "Вид от третьего лица"} aria-pressed={thirdPerson} onClick={() => { thirdPersonRef.current = !thirdPersonRef.current; setThirdPerson(thirdPersonRef.current); enter(); }}>{thirdPerson ? <Eye /> : <PersonStanding />}</Button>}
      {ready && <TimberControls trees={treesRef} player={playerRef} direction={directionRef} time={timeRef} carrying={carryingRef} saw={() => { enter(); onSaw(directionRef.current.x, directionRef.current.z); }} take={() => { enter(); onCarry(); }} />}
      {ready && <ToolControls tools={toolsRef} player={playerRef} owner={ownerRef} onUse={(kind) => { enter(); onTool(kind); }} />}
    </div>
  );
}
