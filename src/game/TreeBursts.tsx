import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TREE_BLAST_SECONDS, type FallingTree } from "./world";

/** Lightweight cartoon fragments; animation never updates React or rebuilds terrain. */
export function TreeBursts({ trees, time }: { trees: RefObject<FallingTree[]>; time: RefObject<number> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(`--game-blast-${name}`).trim();
    return { leaves: token("leaves"), wood: token("wood"), flash: token("flash") };
  }, []);
  useFrame(() => {
    trees.current.forEach((tree, i) => {
      const group = groups.current[i];
      if (!group) return;
      const blast = tree.explosion;
      const age = blast ? time.current - blast.time : TREE_BLAST_SECONDS;
      group.visible = !!blast && age >= 0 && age < TREE_BLAST_SECONDS;
      if (!group.visible || !blast) return;
      group.position.set(blast.x, blast.y + 1.4 * tree.s, blast.z);
      const progress = age / TREE_BLAST_SECONDS;
      group.children.forEach((fragment, j) => {
        const angle = j * 2.399;
        const velocity = 2.5 + j % 4;
        fragment.position.set(Math.cos(angle) * velocity * age, (1.5 + j % 3) * age - 4 * age * age, Math.sin(angle) * velocity * age);
        fragment.rotation.set(age * (j + 2), age * 4, angle + age * 3);
        fragment.scale.setScalar((1 - progress) * (j % 3 === 2 ? 0.16 : 0.25) * tree.s);
      });
    });
  });
  return <>{trees.current.map((_, i) => <group key={i} name="tree-explosion" visible={false} ref={(group) => { groups.current[i] = group; }}>
    {Array.from({ length: 18 }, (_, j) => <mesh key={j}>
      <tetrahedronGeometry args={[1]} />
      <meshStandardMaterial color={j % 3 === 2 ? colors.flash : j % 3 === 1 ? colors.wood : colors.leaves} emissive={colors.flash} emissiveIntensity={j % 3 === 2 ? 1 : 0} flatShading />
    </mesh>)}
  </group>)}</>;
}