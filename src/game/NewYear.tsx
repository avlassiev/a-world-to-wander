import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { calendarAt, santaVisit, GIFTS, DAYS_PER_YEAR } from "./calendar";
import { Html } from "@react-three/drei";
import { addPaint, CANDY_BITES, canPaint, giftBox, MOROZ_X, MOROZ_Z, nearGift, PAINT_COLORS, readGifts, readPaint, writePaint, type GiftState, type PaintMark } from "./gifts";
import type { Body } from "./world";

const WISH_KEY = "forest-santa-wishes-v1";
const now = () => Date.now() / 1000;
export function readWishes(): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(WISH_KEY) ?? "{}") as Record<number, string>; } catch { return {}; }
}

/** 3D Ded Moroz near the player; only appears for players with a delivered wish. */
export function DedMoroz({ pos, override }: { pos: RefObject<Body>; override: RefObject<number | null> }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current; if (!g) return;
    const visit = santaVisit(override.current ?? now(), readWishes());
    g.visible = !!visit?.gift && !pos.current.buried;
    if (!g.visible) return;
    g.position.set(pos.current.x + MOROZ_X, pos.current.y, pos.current.z + MOROZ_Z);
    g.lookAt(pos.current.x, pos.current.y, pos.current.z);
  });
  return <group ref={group} visible={false} name="ded-moroz">
    <mesh position={[0, 0.7, 0]} castShadow><coneGeometry args={[0.55, 1.4, 12]} /><meshStandardMaterial color="#c62828" /></mesh>
    <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.25, 12, 10]} /><meshStandardMaterial color="#f2c9a5" /></mesh>
    <mesh position={[0, 1.4, 0.12]}><coneGeometry args={[0.24, 0.5, 10]} /><meshStandardMaterial color="#ffffff" /></mesh>
    <mesh position={[0, 1.85, 0]}><coneGeometry args={[0.24, 0.45, 10]} /><meshStandardMaterial color="#c62828" /></mesh>
    <mesh position={[0, 2.1, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
    <mesh position={[0.6, 0.9, 0]}><cylinderGeometry args={[0.03, 0.03, 1.8]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
    {([[-0.8, 0.5], [-0.5, 0.9], [-1.1, 0.8]] as const).map(([x, z]) => <group key={`${x}${z}`} position={[x, 0.2, z]}>
      <mesh castShadow><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh><boxGeometry args={[0.42, 0.42, 0.08]} /><meshStandardMaterial color="#fdd835" /></mesh>
    </group>)}
  </group>;
}

function GiftMesh() {
  return <group>
    <mesh castShadow><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color="#c62828" /></mesh>
    <mesh><boxGeometry args={[0.44, 0.44, 0.1]} /><meshStandardMaterial color="#fdd835" /></mesh>
    <mesh><boxGeometry args={[0.1, 0.44, 0.44]} /><meshStandardMaterial color="#fdd835" /></mesh>
  </group>;
}

/** What an opened gift looks like: a lollipop that shrinks with bites, a paint box, or the toy itself. */
function OpenedMesh({ gift, bites }: { gift: string; bites: number }) {
  if (gift === "🍭") {
    const s = 0.4 + 0.6 * (bites / CANDY_BITES);
    return <group>
      <mesh position={[0, -0.15, 0]}><cylinderGeometry args={[0.02, 0.02, 0.4]} /><meshStandardMaterial color="#fafafa" /></mesh>
      <mesh position={[0, 0.12, 0]} scale={s} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 20]} /><meshStandardMaterial color="#ec407a" /></mesh>
    </group>;
  }
  if (gift === "🎨") return <group>
    <mesh><boxGeometry args={[0.5, 0.06, 0.32]} /><meshStandardMaterial color="#fafafa" /></mesh>
    {PAINT_COLORS.map((c, i) => <mesh key={c} position={[-0.18 + i * 0.12, 0.05, 0]}><cylinderGeometry args={[0.045, 0.045, 0.04, 12]} /><meshStandardMaterial color={c} /></mesh>)}
  </group>;
  return <Html center distanceFactor={4} style={{ fontSize: 48, pointerEvents: "none" }}>{gift}</Html>;
}

function Look({ g }: { g: GiftState | null }) {
  return g?.opened ? <OpenedMesh gift={g.gift} bites={g.bites ?? CANDY_BITES} /> : <GiftMesh />;
}

/** The gift box: at Ded Moroz's feet until taken, then carried or lying where it was dropped. */
export function GiftBox({ pos, override, gift, thirdPerson, direction }: { pos: RefObject<Body>; override: RefObject<number | null>; gift: RefObject<GiftState | null>; thirdPerson: RefObject<boolean>; direction: RefObject<{ x: number; z: number }> }) {
  const box = useRef<THREE.Group>(null);
  const dropped = useRef<THREE.Group>(null);
  const held = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(), []);
  const [look, setLook] = useState<GiftState | null>(null);
  const lookKey = useRef("");
  useFrame(() => {
    const cur = gift.current;
    const key = cur ? `${cur.gift}${cur.opened}${cur.bites}` : "";
    if (key !== lookKey.current) { lookKey.current = key; setLook(cur ? { ...cur } : null); }
    const seconds = override.current ?? now();
    const available = giftBox(seconds, readWishes(), readGifts());
    const g = gift.current;
    if (box.current) {
      box.current.visible = !!available && !pos.current.buried;
      if (available) box.current.position.set(pos.current.x + MOROZ_X - 0.9, pos.current.y + 0.25, pos.current.z + MOROZ_Z + 0.7);
    }
    if (dropped.current) {
      dropped.current.visible = !!g && !g.carried && !g.eaten;
      if (g && !g.carried) dropped.current.position.set(g.x, g.y + 0.25, g.z);
    }
    if (held.current) {
      held.current.visible = !!g?.carried;
      if (g?.carried) {
        if (thirdPerson.current) {
          held.current.position.set(pos.current.x + direction.current.x * 0.55, pos.current.y + 1, pos.current.z + direction.current.z * 0.55);
          held.current.rotation.set(0, 0, 0);
        } else {
          offset.set(0.32, -0.42, -0.8).applyQuaternion(camera.quaternion);
          held.current.position.copy(camera.position).add(offset);
          held.current.quaternion.copy(camera.quaternion);
        }
      }
    }
  });
  return <>
    <group ref={box} visible={false} name="gift-box"><GiftMesh /></group>
    <group ref={dropped} visible={false} name="gift-dropped"><Look g={look} /></group>
    <group ref={held} visible={false} name="carried-gift" scale={0.7}><Look g={look} /></group>
  </>;
}

/** Countdown 🎄, wish list 📝 and the New Year result, all with pictures only. */
export const brush = { color: PAINT_COLORS[0] as string };

/** Paint dabs on whatever the crosshair points at; kept in this browser. */
export function PaintMarks({ paintRef }: { paintRef: RefObject<(() => void) | null> }) {
  const { camera, scene } = useThree();
  const [marks, setMarks] = useState<PaintMark[]>([]);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  useEffect(() => { setMarks(readPaint()); }, []);
  useEffect(() => {
    paintRef.current = () => {
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      ray.far = 15;
      const skip = (o: THREE.Object3D | null): boolean => {
        for (let n = o; n; n = n.parent) {
          if (!n.visible) return true;
          if (n.name === "local-player" || n.name.startsWith("remote-player-") || n.name.startsWith("carried-") || n.name.startsWith("gift-") || n.name === "paint-marks" || n.name === "held-tool") return true;
        }
        return false;
      };
      const hit = ray.intersectObjects(scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && !skip(h.object) && h.face);
      if (!hit?.face) return;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (n.dot(ray.ray.direction) > 0) n.negate();
      const p = hit.point.clone().addScaledVector(n, 0.01);
      setMarks((m) => { const next = addPaint(m, { x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z, color: brush.color }); writePaint(next); return next; });
    };
    return () => { paintRef.current = null; };
  }, [camera, scene, ray, paintRef]);
  return <group name="paint-marks">{marks.map((m, i) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(m.nx, m.ny, m.nz));
    return <mesh key={i} position={[m.x, m.y, m.z]} quaternion={q}><circleGeometry args={[0.18, 16]} /><meshStandardMaterial color={m.color} side={THREE.DoubleSide} /></mesh>;
  })}</group>;
}

export function NewYearControls({ override, after, pos, gift, onGift, onUse }: { override: RefObject<number | null>; after: () => void; pos: RefObject<Body>; gift: RefObject<GiftState | null>; onGift: () => void; onUse: () => void }) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const seconds = override.current ?? now();
  const cal = calendarAt(seconds);
  const wishes = readWishes();
  const mine = wishes[cal.year];
  const visit = santaVisit(seconds, wishes);
  const pick = (gift: string) => { localStorage.setItem(WISH_KEY, JSON.stringify({ ...wishes, [cal.year]: gift })); setOpen(false); after(); };
  const heldGift = gift.current;
  const available = giftBox(seconds, wishes, readGifts());
  const nearBox = !!available && nearGift(pos.current, pos.current.x + MOROZ_X - 0.9, pos.current.z + MOROZ_Z + 0.7);
  const nearDropped = !!heldGift && !heldGift.carried && !heldGift.eaten && nearGift(pos.current, heldGift.x, heldGift.z);
  return <div className="game-newyear">
    <div className="game-newyear-count" aria-label={`До Нового года ${cal.daysLeft} дней`} title={`До Нового года ${cal.daysLeft} дней`}>
      <span>🎄</span><b>{cal.daysLeft}</b>
      <span className="game-newyear-dots">{Array.from({ length: DAYS_PER_YEAR }, (_, i) => <i key={i} data-on={i < cal.day ? "" : undefined} />)}</span>
    </div>
    <Button className="game-tool" aria-label="Список Деду Морозу" title="Список Деду Морозу" onClick={() => setOpen(!open)}>
      <span className="game-tool-badge">📝</span>{mine && <span className="game-newyear-mine">{mine}</span>}
    </Button>
    {open && <div className="game-newyear-gifts">{GIFTS.map((g) => <Button key={g} className="game-tool" data-on={mine === g ? "" : undefined} aria-label={`Хочу ${g}`} onClick={() => pick(g)}><span className="game-tool-badge">{g}</span></Button>)}</div>}
    {visit && <div className="game-newyear-visit" aria-label={visit.gift ? "Дед Мороз пришёл" : "Дед Мороз не пришёл"}>🎅{visit.gift ? <>🎁{visit.gift}</> : <>❌📝</>}</div>}
    {(heldGift?.carried || nearBox || nearDropped) && <Button className="game-tool" aria-label={heldGift?.carried ? "Положить подарок" : "Взять подарок"} title={heldGift?.carried ? "Положить подарок" : "Взять подарок"} onClick={() => { onGift(); after(); }}>
      <span className="game-tool-badge">{heldGift?.carried ? "↓" : "✋"}</span><span className="game-newyear-mine">{heldGift?.opened ? heldGift.gift : "🎁"}</span>
    </Button>}
    {heldGift?.carried && (!heldGift.opened || heldGift.gift === "🍭" || heldGift.gift === "🎨") && <Button className="game-tool" aria-label={!heldGift.opened ? "Открыть подарок" : heldGift.gift === "🍭" ? "Съесть" : "Красить"} onClick={() => { onUse(); after(); }}>
      <span className="game-tool-badge">{!heldGift.opened ? "🎁✨" : heldGift.gift === "🍭" ? "😋" : "🖌️"}</span>
    </Button>}
    {canPaint(heldGift) && <div className="game-newyear-gifts">{PAINT_COLORS.map((c) => <Button key={c} className="game-tool" aria-label="Цвет" data-on={brush.color === c ? "" : undefined} onClick={() => { brush.color = c; tick((n) => n + 1); after(); }}><span className="game-paint-dot" style={{ background: c }} /></Button>)}</div>}
  </div>;
}
