import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { daylightAt } from "./daylight";

export function DayNight({ override }: { override: RefObject<number | null> }) {
  const { scene, camera } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.HemisphereLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const moonDisc = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const starMaterial = useRef<THREE.PointsMaterial>(null);
  const colors = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string) => new THREE.Color(css.getPropertyValue(name).trim());
    return { day: read("--game-sky-day"), dusk: read("--game-sky-dusk"), night: read("--game-sky-night"), sun: read("--game-sun"), moon: read("--game-moon"), ground: read("--game-light-ground") };
  }, []);
  const background = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog(colors.day, 60, 260), [colors]);
  const starPositions = useMemo(() => {
    const data = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const azimuth = i * 2.399963;
      const y = 0.08 + ((i * 73) % 600) / 650;
      const radius = Math.sqrt(1 - y * y);
      data.set([Math.cos(azimuth) * radius * 240, y * 240, Math.sin(azimuth) * radius * 240], i * 3);
    }
    return data;
  }, []);
  useEffect(() => {
    const oldBackground = scene.background, oldFog = scene.fog;
    scene.background = background;
    scene.fog = fog;
    return () => { scene.background = oldBackground; scene.fog = oldFog; };
  }, [scene, background, fog]);
  useFrame(() => {
    const sky = daylightAt(override.current ?? Date.now() / 1000);
    background.copy(colors.night).lerp(colors.dusk, sky.daylight).lerp(colors.day, sky.daylight * sky.daylight);
    fog.color.copy(background);
    if (ambient.current) {
      ambient.current.intensity = 0.22 + sky.daylight * 0.55;
      ambient.current.color.copy(colors.moon).lerp(colors.day, sky.daylight);
    }
    if (sun.current) {
      sun.current.intensity = 2.2 * sky.daylight;
      sun.current.position.set(camera.position.x + sky.sunX * 45, sky.sunY * 45, camera.position.z - 20);
      sun.current.target.position.set(camera.position.x, 0, camera.position.z);
      sun.current.target.updateMatrixWorld();
    }
    if (moon.current) moon.current.intensity = 0.35 * (1 - sky.daylight);
    sunDisc.current?.position.set(camera.position.x + sky.sunX * 180, camera.position.y + sky.sunY * 180, camera.position.z - 80);
    moonDisc.current?.position.set(camera.position.x - sky.sunX * 180, camera.position.y - sky.sunY * 180, camera.position.z + 80);
    if (starMaterial.current) starMaterial.current.opacity = 1 - sky.daylight;
    stars.current?.position.copy(camera.position);
  });
  return <>
    <hemisphereLight ref={ambient} args={[colors.day, colors.ground, 0.6]} />
    <directionalLight ref={sun} color={colors.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
    <directionalLight ref={moon} color={colors.moon} position={[-30, 40, 20]} />
    <mesh ref={sunDisc}><sphereGeometry args={[7, 24, 16]} /><meshBasicMaterial color={colors.sun} fog={false} /></mesh>
    <mesh ref={moonDisc}><sphereGeometry args={[5, 24, 16]} /><meshBasicMaterial color={colors.moon} fog={false} /></mesh>
    <points ref={stars}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[starPositions, 3]} /></bufferGeometry>
      <pointsMaterial ref={starMaterial} color={colors.moon} size={0.65} transparent depthWrite={false} fog={false} />
    </points>
  </>;
}