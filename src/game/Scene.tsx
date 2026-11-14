import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PointerLockControls, Sky } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DOOR, EYE, HOUSE, SPEED, WINDOW, growth, inPond, ponds, canDig, DIG_REACH, MAX_HOLES, step, HOLE_START_R, HOLE_START_D, HOLE_MAX_R, HOLE_MAX_D, type Body } from "./world";

function canvasTex(draw: (c: CanvasRenderingContext2D) => void, repeat: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  draw(cv.getContext("2d")!);
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
      for (let i = 0; i < 3000; i++) { c.fillStyle = ["#6fa04a", "#4e7c33", "#7fae55"][i % 3]!; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 4); }
    }, 30);
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
function Growth() {
  const items = useMemo(() => {
    const trees: { x: number; z: number; s: number; birth: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4, rr = 14 + ((i * 7) % 20);
      trees.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, s: 0.8 + ((i * 13) % 6) / 10, birth: i < 20 ? -100 : (i - 20) * 6 });
    }
    const flowers: { x: number; z: number; c: string; birth: number }[] = [];
    for (let i = 0; i < 160 && flowers.length < 120; i++) {
      const a = i * 1.7, rr = 4 + ((i * 11) % 26);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (inPond(x, z, 0.5) || (x > -5 && x < 5 && z > -12 && z < 4)) continue;
      flowers.push({ x, z, c: FLOWER_COLORS[i % FLOWER_COLORS.length]!, birth: i * 1.2 });
    }
    return { trees, flowers };
  }, []);
  const treeRefs = useRef<(THREE.Group | null)[]>([]);
  const flowerRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.trees.forEach((tr, i) => {
      const g = treeRefs.current[i];
      if (g) g.scale.setScalar(tr.s * Math.max(0.001, 0.15 + 0.85 * growth(t, tr.birth)));
    });
    items.flowers.forEach((f, i) => {
      const g = flowerRefs.current[i];
      if (g) g.scale.setScalar(Math.max(0.001, growth(t, f.birth, 5)));
    });
  });
  return (
    <>
      {items.trees.map((tr, i) => (
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

function Player({ onDig, holes }: { onDig: (x: number, z: number) => void; holes: React.RefObject<Hole[]> }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef<Body>({ x: 0, y: 0, z: 6, vy: 0 });
  useEffect(() => {
    camera.position.set(0, EYE, 6);
    camera.lookAt(0, EYE, -8);
    const d = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyE" && !e.repeat) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        onDig(pos.current.x + dir.x * DIG_REACH, pos.current.z + dir.z * DIG_REACH);
      }
    };
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [camera, onDig]);
  const f = new THREE.Vector3(), r = new THREE.Vector3();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05), k = keys.current;
    const fw = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const st = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    camera.getWorldDirection(f); f.y = 0; f.normalize();
    r.crossVectors(f, camera.up).normalize();
    const mx = (f.x * fw + r.x * st) * SPEED * dt, mz = (f.z * fw + r.z * st) * SPEED * dt;
    pos.current = step(pos.current, mx, mz, !!k["Space"], holes.current, dt);
    camera.position.set(pos.current.x, pos.current.y + EYE, pos.current.z);
  });
  return null;
}

type Hole = { x: number; z: number; r: number; d: number; id: number };
const holeMask = new THREE.MeshBasicMaterial({
  colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
});
function Holes({ holes }: { holes: Hole[] }) {
  return (
    <>
      {holes.map((h) => (
        <group key={h.id} position={[h.x, 0, h.z]}>
          {/* cuts the grass so you can see down into the hole */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={holeMask} renderOrder={-1}>
            <circleGeometry args={[h.r, 32]} />
          </mesh>
          <mesh position={[0, -h.d / 2, 0]}>
            <cylinderGeometry args={[h.r, h.r * 0.9, h.d, 32, 1, true]} />
            <meshStandardMaterial color="#5a3b22" side={THREE.BackSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h.d + 0.01, 0]}>
            <circleGeometry args={[h.r * 0.9, 32]} />
            <meshStandardMaterial color="#3a2614" />
          </mesh>
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
  holesRef.current = holes;
  const onDig = useCallback((x: number, z: number) => {
    if (!canDig(x, z)) return;
    setHoles((hs) => {
      const near = hs.find((h) => Math.hypot(h.x - x, h.z - z) < h.r + 0.2);
      if (near)
        return hs.map((h) =>
          h === near
            ? { ...h, r: Math.min(h.r + 0.15, HOLE_MAX_R), d: Math.min(h.d + 0.5, HOLE_MAX_D) }
            : h,
        );
      return [...hs, { x, z, r: HOLE_START_R, d: HOLE_START_D, id: Date.now() + Math.random() }].slice(-MAX_HOLES);
    });
  }, []);
  const { grass } = useTextures();
  return (
    <div className="game-root" data-scene-ready={ready ? "" : undefined}>
      <Canvas shadows gl={{ stencil: true }} camera={{ fov: 70, near: 0.05, far: 200 }}>
        <Sky sunPosition={[30, 20, 10]} turbidity={4} />
        <fog attach="fog" args={["#cfe3ec", 30, 90]} />
        <hemisphereLight args={["#dff1ff", "#5a6b3a", 0.6]} />
        <directionalLight position={[30, 25, 10]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#bcd" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial map={grass} stencilWrite stencilRef={1} stencilWriteMask={0} stencilFunc={THREE.NotEqualStencilFunc} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -1]} receiveShadow>
          <planeGeometry args={[1.4, 8]} />
          <meshStandardMaterial color="#b9a586" />
        </mesh>
        <House />
        <Ponds />
        <Growth />
        <Player onDig={onDig} holes={holesRef} />
        <Holes holes={holes} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        <Ready onReady={() => setReady(true)} />
      </Canvas>
      {!locked && (
        <div className="game-overlay">
          <h1>Домик в лесу</h1>
          <p>Нажмите, чтобы войти в мир</p>
          <p className="hint">W A S D — ходить · мышь — смотреть · E — копать · пробел — прыжок · Esc — пауза</p>
        </div>
      )}
      {locked && <div className="game-crosshair" />}
    </div>
  );
}
