import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { bakeryAssets } from "./bakery-assets";
import {
  facilityNames,
  load,
  names,
  route,
  walls,
  type Cell,
  type Experiment,
  type FacilityId,
  type Worker,
  type WorkerId,
} from "./experiment-engine";
const unit = 1.3;
const point = (p: Cell): [number, number, number] => [
  (p[0] - 4) * unit,
  0,
  (p[1] - 3) * unit,
];
function Camera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, 12, 12);
    camera.lookAt(0, 0, 0);
    const c = camera as THREE.OrthographicCamera;
    c.zoom = Math.min(size.width / 12.4, size.height / 9.4);
    c.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}
/** Keep the existing art files intact; fit standalone props to a board cell. */
function Prop({ url, width }: { url: string; width: number }) {
  const gltf = useGLTF(url);
  const object = useMemo(() => {
    const s = gltf.scene.clone(true);
    if (url.includes("market_stall")) {
      const produce: THREE.Object3D[] = [];
      s.traverse((o) => {
        if (o.name.startsWith("Garden_produce")) produce.push(o);
      });
      for (const object of produce) object.removeFromParent();
    }
    const box = new THREE.Box3().setFromObject(s),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    const scale = width / Math.max(size.x, size.z);
    s.scale.setScalar(scale);
    s.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return s;
  }, [gltf.scene, width, url]);
  return <primitive object={object} />;
}
function Oven({ active }: { active: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.92, 0.9]} />
        <meshStandardMaterial color="#c07847" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.55, 0.46]}>
        <boxGeometry args={[0.7, 0.5, 0.035]} />
        <meshStandardMaterial color="#382d24" />
      </mesh>
      <mesh position={[0, 0.37, 0.49]}>
        <boxGeometry args={[0.55, 0.13, 0.03]} />
        <meshStandardMaterial
          color={active ? "#f7af39" : "#77644a"}
          emissive={active ? "#b44610" : "#000000"}
          emissiveIntensity={active ? 0.8 : 0}
        />
      </mesh>
      <mesh position={[0.32, 1.04, -0.23]} castShadow>
        <boxGeometry args={[0.22, 0.4, 0.25]} />
        <meshStandardMaterial color="#7b624d" />
      </mesh>
      <mesh position={[0, 0.06, 0.53]} receiveShadow>
        <boxGeometry args={[1.15, 0.12, 0.24]} />
        <meshStandardMaterial color="#bcad8c" />
      </mesh>
    </group>
  );
}
function Person({
  worker,
  paused,
  selected,
  labels,
  onPerson,
  target,
}: {
  worker: Worker;
  paused: boolean;
  selected: boolean;
  labels: boolean;
  onPerson: () => void;
  target: Cell | null;
}) {
  const gltf = useGLTF(bakeryAssets[worker.id]);
  const scene = useMemo(() => {
    const s = clone(gltf.scene);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return s;
  }, [gltf.scene]);
  const root = useRef<THREE.Group>(null!);
  const { actions } = useAnimations(gltf.animations, root);
  const clip = worker.next
    ? load(worker)
      ? "Carry"
      : "Walk"
    : worker.task?.started
      ? worker.task.kind === "process"
        ? "Work"
        : worker.task.kind === "eat"
          ? "Talk"
          : "Carry"
      : "Idle";
  useEffect(() => {
    const a = actions[clip] ?? actions.Idle;
    a?.reset().fadeIn(0.15).play();
    return () => {
      a?.fadeOut(0.15);
    };
  }, [actions, clip]);
  useEffect(() => {
    for (const a of Object.values(actions)) if (a) a.paused = paused;
  }, [actions, paused, clip]);
  const destination = point(worker.position);
  useFrame((_, dt) => {
    const r = root.current;
    if (!r) return;
    r.position.lerp(new THREE.Vector3(...destination), 1 - Math.exp(-dt * 20));
    if (worker.next) {
      const next = point(worker.next),
        angle = Math.atan2(next[0] - destination[0], next[2] - destination[2]);
      r.rotation.y +=
        Math.atan2(
          Math.sin(angle - r.rotation.y),
          Math.cos(angle - r.rotation.y),
        ) * Math.min(1, dt * 12);
    } else {
      const p = target ? point(target) : null;
      const angle =
        p && worker.task?.started
          ? Math.atan2(p[0] - destination[0], p[2] - destination[2])
          : 0;
      r.rotation.y +=
        Math.atan2(
          Math.sin(angle - r.rotation.y),
          Math.cos(angle - r.rotation.y),
        ) * Math.min(1, dt * 8);
    }
  });
  return (
    <group
      ref={root}
      position={destination}
      onClick={(e) => {
        e.stopPropagation();
        onPerson();
      }}
    >
      <primitive object={scene} />
      {load(worker) > 0 && (
        <group position={[0, 0.9, 0.4]}>
          <Prop url={bakeryAssets.carry} width={0.48} />
        </group>
      )}
      {selected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshBasicMaterial color="#eebd55" />
        </mesh>
      )}
      {labels && selected && (
        <Html
          center
          position={[0, 1.9, 0]}
          zIndexRange={[8, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span className="exp-scene-label selected">
            {names[worker.id]} · {load(worker)}/2
          </span>
        </Html>
      )}
    </group>
  );
}
export default function ExperimentScene({
  world,
  selected,
  facility,
  labels,
  onPick,
  onPerson,
}: {
  world: Experiment;
  selected: WorkerId;
  facility: FacilityId | null;
  labels: boolean;
  onPick: (p: Cell) => void;
  onPerson: (id: WorkerId) => void;
}) {
  const worker = world.workers.find((w) => w.id === selected)!;
  const path = worker.task
    ? route(world.layout, worker.next ?? worker.position, worker.task.facility)
    : null;
  const line = path
    ? [point(worker.position), ...path.map(point)].map(
        (p) => [p[0], 0.04, p[2]] as [number, number, number],
      )
    : [];
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 12, 12], zoom: 35, near: 0.1, far: 80 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Camera />
      <hemisphereLight args={["#fff4d5", "#7c8b78", 2.1]} />
      <directionalLight
        position={[-5, 12, 7]}
        intensity={3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[6, 7, -5]} color="#c6e8f3" intensity={1.2} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, 0]}
        receiveShadow
      >
        <planeGeometry args={[12, 9.5]} />
        <meshStandardMaterial color="#b5c69b" roughness={1} />
      </mesh>
      {Array.from({ length: 63 }, (_, i) => {
        const cell: Cell = [i % 9, Math.floor(i / 9)],
          p = point(cell),
          wall = walls.some((w) => w[0] === cell[0] && w[1] === cell[1]);
        return (
          <group key={i} position={p}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onPick(cell);
              }}
              receiveShadow
            >
              <planeGeometry args={[unit - 0.05, unit - 0.05]} />
              <meshStandardMaterial
                color={
                  facility
                    ? "#e2dfbf"
                    : (cell[0] + cell[1]) % 2
                      ? "#d9dbbd"
                      : "#ced6b4"
                }
              />
            </mesh>
            {wall && (
              <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
                <boxGeometry args={[unit - 0.07, 0.68, unit - 0.07]} />
                <meshStandardMaterial color="#688456" roughness={1} />
              </mesh>
            )}
          </group>
        );
      })}
      {line.length > 1 && (
        <Line
          points={line}
          color="#b66f29"
          lineWidth={2}
          dashed
          dashSize={0.18}
          gapSize={0.1}
        />
      )}
      <Suspense
        fallback={
          <Html center zIndexRange={[8, 0]}>
            <span className="exp-scene-label">正在放好人物与设施…</span>
          </Html>
        }
      >
        {(["store", "oven", "table"] as FacilityId[]).map((id) => (
          <group
            key={id}
            position={point(world.layout[id])}
            onClick={(e) => {
              e.stopPropagation();
              onPick(world.layout[id]);
            }}
          >
            {id === "store" ? (
              <Prop url="/models/little_house.glb" width={1.08} />
            ) : id === "table" ? (
              <Prop url="/models/market_stall.glb" width={1.08} />
            ) : (
              <Oven active={!!world.batch && !world.paused} />
            )}
            {facility === id && (
              <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.64, 0.7, 32]} />
                <meshBasicMaterial color="#dda444" />
              </mesh>
            )}
            {labels && (
              <Html
                position={[0, id === "store" ? 2 : 1.5, 0]}
                center
                zIndexRange={[7, 0]}
                style={{ pointerEvents: "none" }}
              >
                <span
                  className={`exp-scene-label ${facility === id ? "selected" : ""}`}
                >
                  {facilityNames[id]} ·{" "}
                  {id === "store"
                    ? `${world.stocks.store.grain}份`
                    : id === "oven"
                      ? world.batch
                        ? "烘烤中"
                        : `${world.stocks.oven.grain}料/${world.stocks.oven.bread}饼`
                      : `${world.stocks.table.bread}饼`}
                </span>
              </Html>
            )}
          </group>
        ))}
        {world.workers.map((w) => (
          <Person
            key={w.id}
            worker={w}
            paused={world.paused}
            selected={selected === w.id}
            labels={labels}
            onPerson={() => onPerson(w.id)}
            target={w.task ? world.layout[w.task.facility] : null}
          />
        ))}
      </Suspense>
    </Canvas>
  );
}
