import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CUT_SECONDS } from "./timber";
import { type FallingTree } from "./world";

export function TimberPiece() {
  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    return { bark: css.getPropertyValue("--game-blast-wood").trim(), end: css.getPropertyValue("--game-timber-end").trim() };
  }, []);
  return <group>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.19, 0.23, 1.5, 12]} /><meshStandardMaterial color={colors.bark} flatShading /></mesh>
    {[-0.756, 0.756].map((x) => <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.185, 16]} /><meshStandardMaterial color={colors.end} side={THREE.DoubleSide} /></mesh>)}
  </group>;
}

export function Timber({ trees, time, carrying }: { trees: RefObject<FallingTree[]>; time: RefObject<number>; carrying: RefObject<number> }) {
  const { camera } = useThree();
  const logs = useRef<(THREE.Group | null)[]>([]);
  const stumps = useRef<(THREE.Group | null)[]>([]);
  const held = useRef<THREE.Group>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const bark = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue("--game-blast-wood").trim(), []);
  useFrame(() => {
    trees.current.forEach((tree, i) => {
      const log = logs.current[i];
      const stump = stumps.current[i];
      const cut = tree.cutAt !== undefined && time.current >= tree.cutAt + CUT_SECONDS;
      if (log) {
        log.visible = cut && !!tree.timber && !tree.timber.owner;
        if (tree.timber) log.position.set(tree.timber.x, tree.timber.y + 0.23, tree.timber.z);
      }
      if (stump) {
        stump.visible = tree.cutAt !== undefined;
        stump.position.set(tree.x, 0.12, tree.z);
      }
    });
    if (held.current) {
      held.current.visible = carrying.current >= 0;
      offset.set(0.18, -0.48, -1.05).applyQuaternion(camera.quaternion);
      held.current.position.copy(camera.position).add(offset);
      held.current.quaternion.copy(camera.quaternion);
    }
  });
  return <>
    {trees.current.map((_, i) => <group key={i}>
      <group visible={false} name={`timber-log-${i}`} ref={(group) => { logs.current[i] = group; }}><TimberPiece /></group>
      <group visible={false} ref={(group) => { stumps.current[i] = group; }}><mesh><cylinderGeometry args={[0.2, 0.24, 0.24, 12]} /><meshStandardMaterial color={bark} /></mesh></group>
    </group>)}
    <group ref={held} visible={false} name="carried-timber" scale={0.7}><TimberPiece /></group>
  </>;
}