import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { acceptPose, turnTowards, walkSwing, type Peer, type PlayerPose } from "./multiplayer";
import { type Body } from "./world";
import { TimberPiece } from "./Timber";
import { ToolPiece } from "./Tools";
import { heldTool, type Tool } from "./tools";

export function Avatar({ id, peers, local = false }: { id: string; peers: RefObject<Map<string, Peer>>; local?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const log = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  const phase = useRef(0);
  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--game-player-${name}`).trim();
    return { shirt: token("shirt"), skin: token("skin"), trousers: token("trousers"), boots: token("boots"), eyes: token("eyes") };
  }, []);
  useFrame((_, delta) => {
    const peer = peers.current.get(id);
    const group = body.current;
    if (!peer || !group) return;
    const pose = peer.pose;
    if (log.current) log.current.visible = pose.carrying;
    if (hand.current) for (const child of hand.current.children) child.visible = child.name === `tool-${pose.tool}`;
    group.visible = !pose.buried && performance.now() - peer.received < 8000;
    const blend = local ? 1 : 1 - Math.exp(-15 * Math.min(delta, 0.1));
    if (!initialized.current || Math.hypot(group.position.x - pose.x, group.position.z - pose.z) > 8) {
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.y = pose.yaw;
      initialized.current = true;
    } else {
      group.position.x += (pose.x - group.position.x) * blend;
      group.position.y += (pose.y - group.position.y) * blend;
      group.position.z += (pose.z - group.position.z) * blend;
      group.rotation.y = turnTowards(group.rotation.y, pose.yaw, blend);
    }
    if (head.current) head.current.rotation.x += (pose.pitch - head.current.rotation.x) * blend;
    const walking = pose.moving && performance.now() - peer.received < 700;
    phase.current += Math.min(delta, 0.1) * 10;
    const swing = walkSwing(walking, phase.current);
    for (const [limb, angle] of [[leftLeg.current, swing], [rightLeg.current, -swing], [leftArm.current, pose.carrying ? 1.1 : -swing * 0.7], [rightArm.current, pose.carrying ? 1.1 : swing * 0.7]] as const) {
      if (limb) limb.rotation.x += (angle - limb.rotation.x) * blend;
    }
    group.userData["pose"] = { x: group.position.x, y: group.position.y, z: group.position.z, yaw: group.rotation.y, swing: leftLeg.current?.rotation.x ?? 0 };
  });
  return <group ref={body} name={local ? "local-player" : `remote-player-${id}`}>
    <group ref={log} visible={false} position={[0, 0.98, -0.45]} scale={0.65}><TimberPiece /></group>
    <group ref={hand} position={[0.42, 0.95, -0.15]} rotation={[0.4, 0, -0.2]}>
      {(["shovel", "broom", "weapon"] as const).map((k) => <group key={k} name={`tool-${k}`} visible={false} scale={0.7}><ToolPiece kind={k} /></group>)}
    </group>
    <mesh position={[0, 1.08, 0]} castShadow><boxGeometry args={[0.48, 0.62, 0.28]} /><meshStandardMaterial color={colors.shirt} /></mesh>
    <group ref={head} position={[0, 1.53, 0]}>
      <mesh castShadow><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color={colors.skin} /></mesh>
      {[-0.075, 0.075].map((x) => <mesh key={x} position={[x, 0.035, -0.196]}><sphereGeometry args={[0.028, 8, 6]} /><meshStandardMaterial color={colors.eyes} /></mesh>)}
      <mesh position={[0, -0.035, -0.222]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color={colors.skin} /></mesh>
    </group>
    {[{ ref: leftLeg, x: -0.14 }, { ref: rightLeg, x: 0.14 }].map(({ ref, x }) => <group ref={ref} key={x} position={[x, 0.78, 0]}>
      <mesh position={[0, -0.33, 0]} castShadow><boxGeometry args={[0.19, 0.66, 0.22]} /><meshStandardMaterial color={colors.trousers} /></mesh>
      <mesh position={[0, -0.71, -0.05]} castShadow><boxGeometry args={[0.21, 0.14, 0.32]} /><meshStandardMaterial color={colors.boots} /></mesh>
    </group>)}
    {[{ ref: leftArm, x: -0.33 }, { ref: rightArm, x: 0.33 }].map(({ ref, x }) => <group ref={ref} key={x} position={[x, 1.31, 0]}>
      <mesh position={[0, -0.15, 0]} castShadow><boxGeometry args={[0.16, 0.3, 0.22]} /><meshStandardMaterial color={colors.shirt} /></mesh>
      <mesh position={[0, -0.4, 0]} castShadow><boxGeometry args={[0.14, 0.25, 0.16]} /><meshStandardMaterial color={colors.skin} /></mesh>
    </group>)}
  </group>;
}

export function Multiplayer({ playing, pos, peers, carrying, tools, owner }: { playing: boolean; pos: RefObject<Body>; peers: RefObject<Map<string, Peer>>; carrying: RefObject<number>; tools: RefObject<Tool[]>; owner: RefObject<string> }) {
  const { camera, scene } = useThree();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (!playing) return;
    const id = crypto.randomUUID();
    const channel = supabase.channel("forest-players-v1", {
      config: { presence: { key: id }, broadcast: { self: false, ack: false } },
    });
    let active = true;
    let connected = false;
    let seq = 0;
    let previous: PlayerPose | undefined;
    let lastSent = 0;
    let needsPresence = true;
    let lastX = pos.current.x;
    let lastZ = pos.current.z;
    let lastSample = performance.now();
    const direction = new THREE.Vector3();
    const refresh = () => { if (active) setIds([...peers.current.keys()]); };
    const receive = (value: unknown) => {
      if (active && acceptPose(peers.current, value, id, performance.now())) refresh();
    };
    channel.on("broadcast", { event: "pose" }, ({ payload }) => receive(payload));
    channel.on("presence", { event: "sync" }, () => {
      const present = new Set<string>();
      for (const [key, entries] of Object.entries(channel.presenceState())) {
        present.add(key);
        for (const entry of entries) receive(entry);
      }
      let changed = false;
      for (const key of peers.current.keys()) {
        if (!present.has(key)) { peers.current.delete(key); changed = true; }
      }
      if (changed) refresh();
    });
    const publish = () => {
      if (!active || !connected) return;
      const now = performance.now();
      camera.getWorldDirection(direction);
      const moving = Math.hypot(pos.current.x - lastX, pos.current.z - lastZ) / Math.max(0.001, (now - lastSample) / 1000) > 0.1;
      lastX = pos.current.x; lastZ = pos.current.z; lastSample = now;
      const pose: PlayerPose = {
        id, seq: ++seq, x: pos.current.x, y: pos.current.y, z: pos.current.z,
        yaw: Math.atan2(-direction.x, -direction.z), pitch: Math.asin(Math.max(-1, Math.min(1, direction.y))),
        moving, buried: !!pos.current.buried, carrying: carrying.current >= 0,
        tool: heldTool(tools.current, owner.current),
      };
      const changed = !previous || Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z) > 0.005 || Math.abs(pose.yaw - previous.yaw) > 0.005 || Math.abs(pose.pitch - previous.pitch) > 0.005 || pose.moving !== previous.moving || pose.buried !== previous.buried || pose.carrying !== previous.carrying || pose.tool !== previous.tool;
      if (changed || now - lastSent > 2000) {
        void channel.send({ type: "broadcast", event: "pose", payload: pose });
        previous = pose;
        lastSent = now;
      }
      if (needsPresence) {
        needsPresence = false;
        void channel.track(pose);
      }
    };
    channel.subscribe((status) => {
      connected = status === "SUBSCRIBED";
      if (connected) { needsPresence = true; publish(); }
    });
    const timer = setInterval(publish, 100);
    const leave = () => { void channel.untrack(); };
    window.addEventListener("pagehide", leave);
    if (import.meta.env.DEV && window.__game) {
      window.__game.avatars = () => {
        const result: unknown[] = [];
        scene.traverse((object) => { if (object.name.startsWith("remote-player-")) result.push(object.userData["pose"]); });
        return result;
      };
    }
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      void supabase.removeChannel(channel);
      peers.current.clear();
      setIds([]);
      if (import.meta.env.DEV && window.__game) delete window.__game.avatars;
    };
  }, [playing, camera, scene, pos, peers, carrying, tools, owner]);
  return <>{ids.map((id) => <Avatar key={id} id={id} peers={peers} />)}</>;
}