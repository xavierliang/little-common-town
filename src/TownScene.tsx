import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Html,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { TownState } from "./sim";

const homes: [number, number][] = [
  [-6, -4],
  [-3, -4],
  [3, -4],
  [6, -4],
  [-6, 4],
  [-3, 4],
  [3, 4],
  [6, 4],
];
function Model({
  name,
  position = [0, 0, 0],
  scale = 1,
  rotation = 0,
  walking = false,
}: {
  name: string;
  position?: [number, number, number];
  scale?: number;
  rotation?: number;
  walking?: boolean;
}) {
  const { scene, animations } = useGLTF(`/models/${name}.glb`);
  const copy = useMemo(() => {
    const c = clone(scene);
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(copy), [copy]);
  useEffect(() => {
    const clip = animations.find((c) => c.name === (walking ? "Walk" : "Idle"));
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [mixer, animations, walking]);
  useFrame((_, delta) => {
    if (walking) mixer.update(Math.min(delta, 0.1));
  });
  return (
    <primitive
      object={copy}
      position={position}
      scale={scale}
      rotation-y={rotation}
    />
  );
}
function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.17, 1, 8]} />
        <meshStandardMaterial color="#ac896b" />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshStandardMaterial color="#76a788" roughness={1} />
      </mesh>
      <mesh position={[0.35, 1.25, 0.12]} castShadow>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial color="#91ba8e" roughness={1} />
      </mesh>
    </group>
  );
}
function BuildingLabel({
  position,
  label,
  color = "#476756",
}: {
  position: [number, number, number];
  label: string;
  color?: string;
}) {
  return (
    <Html center position={position} distanceFactor={22} occlude={false}>
      <div className="map-label" style={{ color }}>
        {label}
      </div>
    </Html>
  );
}
function Citizen({
  resident,
  index,
  selected,
  onSelect,
  running,
  state,
}: {
  resident: TownState["residents"][number];
  index: number;
  selected: boolean;
  onSelect: () => void;
  running: boolean;
  state: TownState;
}) {
  const ref = useRef<THREE.Group>(null);
  const home = homes[Math.floor(index / 2)];
  const progress = useRef(4.5);
  const lastDay = useRef(state.day);
  const current = useRef(
    new THREE.Vector3(
      home[0] + (index % 2 ? 0.4 : -0.4),
      0.05,
      home[1] + (home[1] > 0 ? -1.3 : 1.3),
    ),
  );
  const purchase = state.ledger.find(
    (e) =>
      e.day === state.day &&
      e.kind === "purchase" &&
      e.from === resident.accountId,
  );
  const householdTarget = new THREE.Vector3(
    home[0] + (index % 2 ? 0.4 : -0.4),
    0.05,
    home[1] + (home[1] > 0 ? -1.3 : 1.3),
  );
  const workTarget = resident.employerId
    ? new THREE.Vector3(
        resident.employerId === "f1" ? -5.5 : 5.5,
        0.05,
        ((index % 5) - 2) * 0.35,
      )
    : householdTarget;
  const shopTarget = purchase
    ? new THREE.Vector3(
        purchase.to === "f1" ? -5 : 5,
        0.05,
        ((index % 5) - 2) * 0.4,
      )
    : workTarget;
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (lastDay.current !== state.day) {
      lastDay.current = state.day;
      progress.current = 0;
    }
    if (running)
      progress.current = Math.min(4.5, progress.current + Math.min(delta, 0.1));
    const t = progress.current;
    const target = t < 1.5 ? workTarget : t < 3 ? shopTarget : householdTarget;
    const dx = target.x - current.current.x,
      dz = target.z - current.current.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.03)
      ref.current.rotation.y = Math.atan2(dx, dz);
    current.current.lerp(target, Math.min(1, delta * 4));
    ref.current.position.copy(current.current);
  });
  return (
    <group
      ref={ref}
      position={householdTarget}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Model name="resident" scale={0.52} walking={running} />
      {selected && (
        <>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.38, 0.51, 32]} />
            <meshBasicMaterial color="#efa64e" side={THREE.DoubleSide} />
          </mesh>
          <Html position={[0, 1.35, 0]} center distanceFactor={18}>
            <button className="citizen-name active" onClick={onSelect}>
              {resident.name}
            </button>
          </Html>
        </>
      )}
      {!selected && resident.hunger > 0 && (
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#d98562" />
        </mesh>
      )}
    </group>
  );
}
function Village({
  state,
  selected,
  onSelect,
  running,
}: {
  state: TownState;
  selected: string;
  onSelect: (id: string) => void;
  running: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#e7eee6"]} />
      <fog attach="fog" args={["#e7eee6", 30, 68]} />
      <ambientLight intensity={1.6} />
      <hemisphereLight args={["#fff8e8", "#bed2bc", 1.4]} />
      <directionalLight
        position={[-8, 15, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <boxGeometry args={[20, 0.8, 16]} />
        <meshStandardMaterial color="#a7be98" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.035, 0]} receiveShadow>
        <planeGeometry args={[19.85, 15.85]} />
        <meshStandardMaterial color="#c1d0a8" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[17, 2.5]} />
        <meshStandardMaterial color="#e4d7b7" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.009, 0]} receiveShadow>
        <planeGeometry args={[2.25, 13]} />
        <meshStandardMaterial color="#e4d7b7" />
      </mesh>
      {homes.map(([x, z], i) => (
        <group key={i}>
          <Model
            name="little_house"
            position={[x, 0, z]}
            scale={0.75}
            rotation={z < 0 ? 0 : Math.PI}
          />
        </group>
      ))}
      <group position={[-6.8, 0, 0]}>
        <Model name="little_house" scale={0.8} rotation={Math.PI / 2} />
        <Model name="ai_helper" position={[1.5, 0, 0.5]} scale={0.45} />
        <BuildingLabel label="麦穗合作社" position={[0, 3, 0]} />
      </group>
      <group position={[6.8, 0, 0]}>
        <Model name="little_house" scale={0.8} rotation={-Math.PI / 2} />
        <BuildingLabel label="晨光食品坊" position={[0, 3, 0]} />
      </group>
      <group position={[0, 0, -5.3]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[2.2, 1.5, 1.7]} />
          <meshStandardMaterial color="#f1dfbd" />
        </mesh>
        <mesh position={[0, 1.7, 0]} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[1.7, 0.7, 4]} />
          <meshStandardMaterial color="#8baabc" />
        </mesh>
        <mesh position={[0, 0.55, 0.86]}>
          <boxGeometry args={[0.48, 1.1, 0.05]} />
          <meshStandardMaterial color="#9f7e68" />
        </mesh>
      </group>
      <mesh position={[0, 0.17, 2.6]} castShadow>
        <cylinderGeometry args={[0.9, 1, 0.32, 32]} />
        <meshStandardMaterial color="#e8d7b8" />
      </mesh>
      <mesh position={[0, 0.35, 2.6]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.78, 32]} />
        <meshStandardMaterial color="#91c6c7" roughness={0.2} />
      </mesh>
      {[
        [-8, -6],
        [-8, 6],
        [8, -6],
        [8, 6],
        [-4.6, -6.8],
        [4.6, 6.8],
        [-8.8, -2.5],
        [8.8, 2.6],
      ].map(([x, z], i) => (
        <Tree key={i} x={x} z={z} scale={0.8 + (i % 3) * 0.12} />
      ))}
      <Model name="market_stall" position={[0, 0, 5.2]} scale={0.9} />

      <Model name="planter" position={[-1.6, 0, 2.6]} scale={0.65} />
      <Model name="planter" position={[1.6, 0, 2.6]} scale={0.65} />
      {state.residents.map((r, i) => (
        <Citizen
          key={r.id}
          resident={r}
          state={state}
          index={i}
          selected={selected === r.id}
          onSelect={() => onSelect(r.id)}
          running={running}
        />
      ))}
      <ContactShadows
        position={[0, -0.04, 0]}
        opacity={0.2}
        scale={25}
        blur={2}
        far={8}
      />
      <OrbitControls
        makeDefault
        target={[0, 0.1, 0]}
        minDistance={12}
        maxDistance={35}
        minPolarAngle={0.25}
        maxPolarAngle={1.25}
        enablePan
        panSpeed={0.55}
      />
    </>
  );
}
export default function TownScene(props: {
  state: TownState;
  selected: string;
  onSelect: (id: string) => void;
  running: boolean;
}) {
  return (
    <Canvas shadows camera={{ position: [18, 20, 24], fov: 40 }} dpr={[1, 1.5]}>
      <Suspense
        fallback={
          <Html center>
            <div className="loading">正在搭建小镇…</div>
          </Html>
        }
      >
        <Village {...props} />
      </Suspense>
    </Canvas>
  );
}
