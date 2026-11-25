import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { calendarAt, santaVisit, GIFTS, DAYS_PER_YEAR } from "./calendar";
import type { Body } from "./world";

const WISH_KEY = "forest-santa-wishes-v1";
const now = () => Date.now() / 1000;
function readWishes(): Record<number, string> {
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
    g.position.set(pos.current.x + 2.5, pos.current.y, pos.current.z - 2.5);
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

/** Countdown 🎄, wish list 📝 and the New Year result, all with pictures only. */
export function NewYearControls({ override, after }: { override: RefObject<number | null>; after: () => void }) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const seconds = override.current ?? now();
  const cal = calendarAt(seconds);
  const wishes = readWishes();
  const mine = wishes[cal.year];
  const visit = santaVisit(seconds, wishes);
  const pick = (gift: string) => { localStorage.setItem(WISH_KEY, JSON.stringify({ ...wishes, [cal.year]: gift })); setOpen(false); after(); };
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
  </div>;
}
