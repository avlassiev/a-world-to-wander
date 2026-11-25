import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { calendarAt, santaVisit, GIFTS, DAYS_PER_YEAR } from "./calendar";
import { giftBox, MOROZ_X, MOROZ_Z, nearGift, readGifts, type GiftState } from "./gifts";
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

/** The gift box: at Ded Moroz's feet until taken, then carried or lying where it was dropped. */
export function GiftBox({ pos, override, gift, thirdPerson, direction }: { pos: RefObject<Body>; override: RefObject<number | null>; gift: RefObject<GiftState | null>; thirdPerson: RefObject<boolean>; direction: RefObject<{ x: number; z: number }> }) {
  const box = useRef<THREE.Group>(null);
  const dropped = useRef<THREE.Group>(null);
  const held = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const seconds = override.current ?? now();
    const available = giftBox(seconds, readWishes(), readGifts());
    const g = gift.current;
    if (box.current) {
      box.current.visible = !!available && !pos.current.buried;
      if (available) box.current.position.set(pos.current.x + MOROZ_X - 0.9, pos.current.y + 0.25, pos.current.z + MOROZ_Z + 0.7);
    }
    if (dropped.current) {
      dropped.current.visible = !!g && !g.carried;
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
    <group ref={dropped} visible={false} name="gift-dropped"><GiftMesh /></group>
    <group ref={held} visible={false} name="carried-gift" scale={0.7}><GiftMesh /></group>
  </>;
}

/** Countdown 🎄, wish list 📝 and the New Year result, all with pictures only. */
export function NewYearControls({ override, after, pos, gift, onGift }: { override: RefObject<number | null>; after: () => void; pos: RefObject<Body>; gift: RefObject<GiftState | null>; onGift: () => void }) {
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
  const nearDropped = !!heldGift && !heldGift.carried && nearGift(pos.current, heldGift.x, heldGift.z);
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
      <span className="game-tool-badge">{heldGift?.carried ? "↓" : "✋"}</span><span className="game-newyear-mine">🎁</span>
    </Button>}
  </div>;
}
