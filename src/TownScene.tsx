import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { TownState } from "./sim";
import layout from "./town-layout.json";
import {
  routeBetween,
  pointOnRoute,
  residentHome,
  buildingForHouse,
  firstHouseForBuilding,
  type Point,
} from "./scene-routes";
type Focus = { kind: "resident" | "building"; id: string } | null;
type SceneProps = {
  state: TownState;
  selected: string;
  onSelect: (id: string) => void;
  running: boolean;
  selectedBuilding?: string;
  onBuildingSelect?: (id: string) => void;
  focus?: Focus;
  resetView?: number;
  hideLabels?: boolean;
};
function Asset({
  file,
  scale = 1,
  position = [0, 0, 0],
  walking = false,
  variant = 0,
}: {
  file: string;
  scale?: number;
  position?: Point;
  walking?: boolean;
  variant?: number;
}) {
  const { scene, animations } = useGLTF("/models/" + file);
  const model = useMemo(() => {
    const c = clone(scene);
    const tint = ["#527f97", "#748a64", "#b77e65", "#9d986d"][variant % 4];
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (variant && file === "resident.glb") {
          const wasArray = Array.isArray(o.material);
          const mats = wasArray
            ? (o.material as THREE.Material[])
            : [o.material as THREE.Material];
          const changed = mats.map((m) => {
            const material = m.clone();
            if (
              material instanceof THREE.MeshStandardMaterial &&
              /denim|overall|blue/i.test(material.name)
            )
              material.color.set(tint);
            return material;
          });
          o.material = wasArray ? changed : changed[0];
        }
      }
    });
    return c;
  }, [scene, file, variant]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  useEffect(() => {
    const clip = animations.find((a) => a.name === (walking ? "Walk" : "Idle"));
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [walking, mixer, animations]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.05)));
  return <primitive object={model} scale={scale} position={position} />;
}
function Resident({
  r,
  index,
  state,
  selected,
  onSelect,
  running,
  hideLabels,
  positions,
}: {
  r: TownState["residents"][number];
  index: number;
  state: TownState;
  selected: boolean;
  onSelect: () => void;
  running: boolean;
  hideLabels: boolean;
  positions: MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const ref = useRef<THREE.Group>(null),
    elapsed = useRef(4.5),
    day = useRef(state.day);
  const home = residentHome(index);
  const purchase = state.ledger.find(
    (e) =>
      e.day === state.day && e.kind === "purchase" && e.from === r.accountId,
  );
  const shift = (p: number[]): Point => [
    p[0] + ((index % 3) - 1) * 0.35,
    p[1],
    p[2] + Math.floor((index % 6) / 3) * 0.45,
  ];
  const work = r.employerId
    ? shift(layout.workAnchors[r.employerId as "f1" | "f2"])
    : home;
  const shop = purchase
    ? shift(layout.workAnchors[purchase.to as "f1" | "f2"] || home)
    : work;
  const paths = useMemo(
    () => [
      routeBetween(home, work),
      routeBetween(work, shop),
      routeBetween(shop, home),
    ],
    [state.day, r.employerId, purchase?.to, index],
  );
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (day.current !== state.day) {
      day.current = state.day;
      elapsed.current = 0;
    }
    if (running) elapsed.current = Math.min(4.5, elapsed.current + dt);
    const t = elapsed.current;
    const leg = Math.min(2, Math.floor(t / 1.5));
    const p = pointOnRoute(paths[leg], Math.min(1, (t - leg * 1.5) / 1.5));
    const previous = ref.current.position;
    const dx = p[0] - previous.x,
      dz = p[2] - previous.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001)
      ref.current.rotation.y = Math.atan2(dx, dz);
    ref.current.position.set(...p);
    positions.current[r.id] = ref.current.position.clone();
  });
  return (
    <group
      ref={ref}
      position={home}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Asset
        file="resident.glb"
        scale={layout.resident.scale}
        walking={running}
        variant={index}
      />
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.43, 0.55, 36]} />
          <meshBasicMaterial color="#f4be65" side={THREE.DoubleSide} />
        </mesh>
      )}
      {selected && !hideLabels && (
        <Html
          position={[0, 1.95, 0]}
          center
          distanceFactor={13}
          zIndexRange={[9, 0]}
        >
          <button className="citizen-name" onClick={onSelect}>
            {r.name}
          </button>
        </Html>
      )}
      {r.hunger > 0 && !selected && (
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#d88d60" />
        </mesh>
      )}
    </group>
  );
}
function CameraRig({
  focus,
  resetView,
  positions,
}: {
  focus: Focus;
  resetView: number;
  positions: MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const controls = useRef<any>(null);
  const { camera, size } = useThree();
  const destination = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.setViewOffset(
        size.width,
        size.height,
        0,
        size.height * (size.width < 700 ? 0.13 : 0.1),
        size.width,
        size.height,
      );
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
  useEffect(() => {
    const mobile = size.width < 700;
    let target = new THREE.Vector3(0, 0.8, 0.4),
      position = new THREE.Vector3(
        mobile ? 15 : 18,
        mobile ? 18 : 20,
        mobile ? 23 : 26,
      );
    if (focus) {
      if (focus.kind === "resident")
        target =
          positions.current[focus.id]?.clone() ||
          new THREE.Vector3(...residentHome(Number(focus.id.slice(1)) - 1));
      else {
        const id =
          focus.id.startsWith("h") && focus.id !== "hall"
            ? buildingForHouse(focus.id)
            : focus.id;
        const b = layout.buildingHotspots.find((h) => h.id === id);
        if (b) target = new THREE.Vector3(...(b.center as Point));
      }
      target.y = Math.max(0.8, target.y);
      position = target
        .clone()
        .add(
          new THREE.Vector3(mobile ? 7 : 10, mobile ? 9 : 12, mobile ? 11 : 15),
        );
    }
    destination.current = { position, target };
  }, [focus?.kind, focus?.id, resetView]);
  useFrame((_, dt) => {
    const dest = destination.current;
    if (!dest || !controls.current) return;
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(dest.position, k);
    controls.current.target.lerp(dest.target, k);
    controls.current.update();
    if (camera.position.distanceTo(dest.position) < 0.05)
      destination.current = null;
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0.8, 0.4]}
      enableDamping
      dampingFactor={0.1}
      minDistance={9}
      maxDistance={52}
      minPolarAngle={0.35}
      maxPolarAngle={1.3}
      onStart={() => {
        destination.current = null;
      }}
      panSpeed={0.7}
      rotateSpeed={0.6}
    />
  );
}
function Village(props: SceneProps) {
  const positions = useRef<Record<string, THREE.Vector3>>({});
  const selectedObject = props.selectedBuilding?.startsWith("h")
    ? buildingForHouse(props.selectedBuilding)
    : props.selectedBuilding;
  return (
    <>
      <color attach="background" args={["#d8e6dc"]} />
      <fog attach="fog" args={["#d8e6dc", 45, 90]} />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#fff3dc", "#92ad8d", 1.7]} />
      <directionalLight
        castShadow
        position={[-12, 23, 15]}
        intensity={2.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0008}
      />
      <Asset file="town_environment.glb" />
      {layout.buildingHotspots.map((b) => (
        <group key={b.id}>
          <mesh
            position={b.center as Point}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              props.onBuildingSelect?.(
                b.id.startsWith("home_") ? firstHouseForBuilding(b.id) : b.id,
              );
            }}
          >
            <boxGeometry args={b.size as Point} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {selectedObject === b.id && (
            <mesh
              position={[b.center[0], 0.08, b.center[2]]}
              rotation-x={-Math.PI / 2}
            >
              <ringGeometry
                args={[
                  Math.max(b.size[0], b.size[2]) * 0.54,
                  Math.max(b.size[0], b.size[2]) * 0.57,
                  48,
                ]}
              />
              <meshBasicMaterial color="#e8bc6d" side={THREE.DoubleSide} />
            </mesh>
          )}
          {selectedObject === b.id && !props.hideLabels && (
            <Html
              center
              position={[b.center[0], b.size[1] + 0.3, b.center[2]]}
              distanceFactor={16}
              zIndexRange={[8, 0]}
            >
              <span className="map-label">
                {b.id === "f1"
                  ? "麦穗合作社"
                  : b.id === "f2"
                    ? "晨光食品坊"
                    : b.id === "hall"
                      ? "议事厅"
                      : "居民小屋"}
              </span>
            </Html>
          )}
        </group>
      ))}
      {props.state.residents.map((r, i) => (
        <Resident
          key={r.id}
          r={r}
          index={i}
          state={props.state}
          selected={props.selected === r.id}
          onSelect={() => props.onSelect(r.id)}
          running={props.running}
          hideLabels={!!props.hideLabels}
          positions={positions}
        />
      ))}
      <Asset
        file="ai_helper.glb"
        scale={layout.robot.scale}
        position={[-5.1, 0.06, 3.1]}
      />
      <Asset
        file="ai_helper.glb"
        scale={layout.robot.scale}
        position={[5.1, 0.06, 3.4]}
      />
      <CameraRig
        focus={props.focus || null}
        resetView={props.resetView || 0}
        positions={positions}
      />
    </>
  );
}
export default function TownScene(props: SceneProps) {
  return (
    <Canvas shadows camera={{ position: [18, 20, 26], fov: 42 }} dpr={[1, 1.5]}>
      <Suspense
        fallback={
          <Html center zIndexRange={[5, 0]}>
            <div className="loading">小镇正在醒来…</div>
          </Html>
        }
      >
        <Village {...props} />
      </Suspense>
    </Canvas>
  );
}
