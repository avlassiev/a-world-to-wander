import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PointerLockControls, Sky } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DOOR, EYE, HOUSE, SPEED, WINDOW, growth, inPond, ponds, DIG_REACH, step, createTrees, attractTrees, treePose, fillHole, digHole, digTunnel, recoverTrees, TUNNEL_HEIGHT, tunnelWidth, tunnelFurnishings, type Tunnel, type FallingTree, type Body } from "./world";

declare global {
  interface Window {
    __game?: {
      dig: (x: number, z: number) => void;
      fill: (x: number, z: number) => void;
      tunnel: (dirX: number, dirZ: number) => void;
      sim: (seconds: number) => void;
      view?: (x: number, z: number, targetX: number, targetZ: number) => void;
      readonly state: { player: Body; holes: Hole[]; tunnels: Tunnel[]; furnishings: ReturnType<typeof tunnelFurnishings>; trees: (ReturnType<typeof treePose> & { buried: boolean })[] };
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
  const seen = useRef(new Map<number, string>());
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
        g.visible = !tr.buried;
        const pose = treePose(tr, t);
        g.position.set(pose.x, pose.y, pose.z);
        g.rotation.set(pose.tilt * Math.cos(pose.heading), 0, -pose.tilt * Math.sin(pose.heading));
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

function Player({ onDig, onFill, onTunnel, holes, tunnels, pos, advance }: { onDig: (x: number, z: number) => void; onFill: (x: number, z: number) => void; onTunnel: (x: number, z: number) => void; holes: React.RefObject<Hole[]>; tunnels: React.RefObject<Tunnel[]>; pos: React.RefObject<Body>; advance: React.RefObject<(dt: number) => void> }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const earth = useRef<THREE.Mesh>(null);
  const lantern = useRef<THREE.PointLight>(null);
  const { wood } = useTextures();
  useEffect(() => {
    camera.position.set(0, EYE, 6);
    camera.lookAt(0, EYE, -8);
    if (import.meta.env.DEV && window.__game) window.__game.view = (x, z, targetX, targetZ) => {
      pos.current = { x, y: 0, z, vy: 0 };
      camera.position.set(x, EYE, z);
      camera.lookAt(targetX, 0, targetZ);
    };
    const d = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if ((e.code === "KeyE" || e.code === "KeyF" || e.code === "KeyT") && !e.repeat) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const x = pos.current.x + dir.x * DIG_REACH, z = pos.current.z + dir.z * DIG_REACH;
        if (e.code === "KeyT") onTunnel(dir.x, dir.z);
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
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [camera, onDig, onFill, onTunnel, holes, pos]);
  const f = new THREE.Vector3(), r = new THREE.Vector3();
  const tick = (dt: number) => {
    const k = keys.current;
    const fw = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const st = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    camera.getWorldDirection(f); f.y = 0; f.normalize();
    r.crossVectors(f, camera.up).normalize();
    const mx = (f.x * fw + r.x * st) * SPEED * dt, mz = (f.z * fw + r.z * st) * SPEED * dt;
    pos.current = step(pos.current, mx, mz, !!k["Space"], holes.current, dt, tunnels.current);
    camera.position.set(pos.current.x, pos.current.y + EYE, pos.current.z);
    if (lantern.current) lantern.current.position.copy(camera.position);
    if (earth.current) {
      earth.current.visible = !!pos.current.buried;
      earth.current.position.copy(camera.position);
    }
  };
  advance.current = tick;
  useFrame((_, delta) => tick(Math.min(delta, 0.05)));
  return <><pointLight ref={lantern} intensity={7} distance={9} decay={1.5} /><mesh ref={earth} visible={false} renderOrder={1000}>
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

/** Distant hills and a far forest so the horizon never looks empty. */
function Horizon() {
  const hills = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.13;
    const rr = 300 + ((i * 37) % 120);
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, s: 60 + ((i * 23) % 50), h: 14 + ((i * 17) % 12) };
  }), []);
  const farTrees = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const a = i * 2.399, rr = 55 + ((i * 29) % 200);
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, s: 0.9 + ((i * 7) % 8) / 10 };
  }), []);
  return (
    <>
      {hills.map((hl, i) => (
        <mesh key={`h${i}`} position={[hl.x, 0, hl.z]}>
          <coneGeometry args={[hl.s, hl.h, 7]} />
          <meshStandardMaterial color={i % 2 ? "#4e7c33" : "#5f8f3e"} flatShading />
        </mesh>
      ))}
      {farTrees.map((t, i) => (
        <group key={`t${i}`} position={[t.x, 0, t.z]} scale={t.s}>
          <Tree />
        </group>
      ))}
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const n = useRef(0);
  useFrame(() => { if (++n.current === 2) onReady(); });
  return null;
}

export default function World() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [holes, setHoles] = useState<Hole[]>([]);
  const holesRef = useRef<Hole[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const tunnelsRef = useRef<Tunnel[]>([]);
  const treesRef = useRef(createTrees());
  const timeRef = useRef(0);
  const advanceRef = useRef<(seconds: number) => void>(() => {});
  const playerRef = useRef<Body>({ x: 0, y: 0, z: 6, vy: 0 });
  const playerAdvanceRef = useRef<(dt: number) => void>(() => {});
  holesRef.current = holes;
  const onDig = useCallback((x: number, z: number) => {
    const next = digHole(holesRef.current, x, z, Date.now() + Math.random());
    for (const pit of next) recoverTrees(treesRef.current, pit, timeRef.current);
    holesRef.current = next;
    setHoles(next);
    advanceRef.current(0);
  }, []);
  const onTunnel = useCallback((x: number, z: number) => {
    const next = digTunnel(holesRef.current, tunnelsRef.current, playerRef.current, x, z);
    tunnelsRef.current = next;
    setTunnels(next);
  }, []);
  const onFill = useCallback((x: number, z: number) => {
    const result = fillHole(holesRef.current, treesRef.current, x, z, playerRef.current);
    if (result.player) playerRef.current = result.player;
    holesRef.current = result.holes;
    treesRef.current = result.trees;
    setHoles(result.holes);
    advanceRef.current(0);
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const previousView = window.__game?.view;
    window.__game = {
      dig: onDig,
      fill: onFill,
      tunnel: onTunnel,
      sim: (seconds) => {
        advanceRef.current(seconds);
        for (let remaining = seconds; remaining > 0; remaining -= 1 / 60) playerAdvanceRef.current(Math.min(remaining, 1 / 60));
      },
      ...(previousView ? { view: previousView } : {}),
      get state() { return { player: { ...playerRef.current }, holes: holesRef.current, tunnels: tunnelsRef.current, furnishings: tunnelFurnishings(tunnelsRef.current), trees: treesRef.current.map((tr) => ({ ...treePose(tr, timeRef.current), buried: !!tr.buried })) }; },
    };
    return () => { delete window.__game; };
  }, [onDig, onFill, onTunnel]);
  const { grass } = useTextures();
  return (
    <div className="game-root" data-scene-ready={ready ? "" : undefined}>
      <Canvas shadows gl={{ stencil: true }} camera={{ fov: 70, near: 0.05, far: 600 }}>
        <Sky sunPosition={[30, 20, 10]} turbidity={4} />
        <fog attach="fog" args={["#cfe3ec", 60, 260]} />
        <hemisphereLight args={["#dff1ff", "#5a6b3a", 0.6]} />
        <directionalLight position={[30, 25, 10]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#bcd" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1200, 1200]} />
          <meshStandardMaterial map={grass} stencilWrite stencilRef={1} stencilWriteMask={0} stencilFunc={THREE.NotEqualStencilFunc} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -1]} receiveShadow>
          <planeGeometry args={[1.4, 8]} />
          <meshStandardMaterial color="#b9a586" />
        </mesh>
        <House />
        <Ponds />
        <Horizon />
        <Growth holes={holesRef} trees={treesRef} time={timeRef} advance={advanceRef} />
        <Player onDig={onDig} onFill={onFill} onTunnel={onTunnel} holes={holesRef} tunnels={tunnelsRef} pos={playerRef} advance={playerAdvanceRef} />
        <Holes holes={holes} tunnels={tunnels} />
        <TunnelFurniture tunnels={tunnels} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        <Ready onReady={() => setReady(true)} />
      </Canvas>
      {!locked && (
        <div className="game-overlay">
          <h1>Домик в лесу</h1>
          <p>Нажмите, чтобы войти в мир</p>
          <p className="hint">W A S D — ходить · мышь — смотреть · E — копать · T — туннель · F — закапывать · пробел — прыжок · Esc — пауза</p>
        </div>
      )}
      {locked && <div className="game-crosshair" />}
    </div>
  );
}
