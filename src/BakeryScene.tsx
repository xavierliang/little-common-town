import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { anchors, bakeryRoute, type BakeryPlace } from "./bakery-scene-routes";
import { actorFacing, cameraFrame } from "./bakery-presentation";
import { bakeryAssets } from "./bakery-assets";
export type { BakeryPlace } from "./bakery-scene-routes";

export type BakeryPerson = "ahe" | "xiaoman";
export type SceneBeat = {
  ahe: BakeryPlace;
  xiaoman: BakeryPlace;
  label: string;
  active: boolean;
};
const names = { ahe: "阿禾", xiaoman: "小满" };
function Camera({
  focus,
  beat,
}: {
  focus: BakeryPerson | "wide" | "auto";
  beat: SceneBeat;
}) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.65, 0.1));
  const framing = useMemo(() => cameraFrame(focus, beat), [focus, beat]);
  const destination = useMemo(
    () => new THREE.Vector3(...framing.target),
    [framing],
  );
  useFrame((_, dt) => {
    target.current.lerp(destination, 1 - Math.exp(-dt * 2.6));
    camera.position.copy(target.current).add(new THREE.Vector3(11, 13, 16));
    camera.lookAt(target.current);
    const c = camera as THREE.OrthographicCamera;
    const desired = Math.min(
      size.width / framing.horizontalSpan,
      size.height / framing.verticalSpan,
    );
    c.zoom = THREE.MathUtils.damp(c.zoom, desired, 3, dt);
    c.updateProjectionMatrix();
  });
  return null;
}
function Environment({
  onPlace,
  active,
  paused,
}: {
  onPlace: (place: BakeryPlace) => void;
  active: boolean;
  paused: boolean;
}) {
  const gltf = useGLTF(bakeryAssets.environment);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return s;
  }, [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const a = actions.Machine_Mix;
    if (a) {
      a.play();
      a.paused = !active || paused;
    }
  }, [actions, active, paused]);
  return (
    <>
      <primitive object={scene} />
      {(["machine", "counter", "rest", "study"] as BakeryPlace[]).map(
        (place) => (
          <mesh
            key={place}
            position={[anchors[place][0], 0.7, anchors[place][2]]}
            onClick={(e) => {
              e.stopPropagation();
              onPlace(place);
            }}
          >
            <boxGeometry args={[1.2, 1.4, 1.2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ),
      )}
    </>
  );
}
function Person({
  id,
  place,
  active,
  paused,
  selected,
  onSelect,
  labels,
  onArrive,
  beatKey,
}: {
  id: BakeryPerson;
  place: BakeryPlace;
  active: boolean;
  paused: boolean;
  selected: boolean;
  labels: boolean;
  onArrive: () => void;
  beatKey: string;
  onSelect: () => void;
}) {
  const gltf = useGLTF(bakeryAssets[id]);
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
  const phase = useRef("");
  const arrived = useRef(false);
  useEffect(() => {
    arrived.current = false;
  }, [beatKey]);
  const dest = useMemo(() => {
    const v = new THREE.Vector3(...anchors[place]);
    v.x += id === "ahe" ? -0.25 : 0.25;
    return v;
  }, [place, id]);
  const route = useRef<THREE.Vector3[]>([]);
  useEffect(() => {
    const p =
      root.current?.position.clone() ?? new THREE.Vector3(...anchors.counter);
    route.current = bakeryRoute([p.x, p.y, p.z], place).map(
      (v) => new THREE.Vector3(...v),
    );
    if (route.current.length)
      route.current[route.current.length - 1].x += id === "ahe" ? -0.22 : 0.22;
  }, [dest, place]);
  useEffect(() => {
    for (const a of Object.values(actions)) {
      if (a) a.paused = paused;
    }
  }, [actions, paused]);
  useFrame((state, dt) => {
    if (paused) return;
    const g = root.current;
    if (!g) return;
    const next = route.current[0];
    let walking = false;
    if (next) {
      const direction = next.clone().sub(g.position);
      const distance = direction.length();
      if (distance < 0.06) route.current.shift();
      else {
        walking = true;
        g.position.addScaledVector(
          direction.normalize(),
          Math.min(dt * 1.65, distance),
        );
        const a = Math.atan2(direction.x, direction.z);
        g.rotation.y +=
          Math.atan2(Math.sin(a - g.rotation.y), Math.cos(a - g.rotation.y)) *
          Math.min(1, dt * 8);
      }
    }
    if (!route.current.length && !arrived.current) {
      arrived.current = true;
      onArrive();
    }
    const name =
      place === "delivery"
        ? "Carry"
        : walking
          ? "Walk"
          : active && !["rest", "study", "delivery"].includes(place)
            ? "Work"
            : "Idle";
    if (phase.current !== name) {
      actions[phase.current]?.fadeOut(0.18);
      (actions[name] ?? actions.Idle)?.reset().fadeIn(0.18).play();
      phase.current = name;
    }
    if (actions.Carry) {
      const holding = place === "delivery" && !walking;
      if (holding && !actions.Carry.paused) actions.Carry.time = 0;
      actions.Carry.paused = holding;
    }
    if (!walking) {
      const facing = actorFacing(place, active);
      g.rotation.y +=
        Math.atan2(
          Math.sin(facing - g.rotation.y),
          Math.cos(facing - g.rotation.y),
        ) * Math.min(1, dt * 4);
    }
    if (!walking && !gltf.animations.length)
      g.rotation.z = Math.sin(state.clock.elapsedTime * 1.8) * 0.012;
  });
  return (
    <group
      ref={root}
      position={[id === "ahe" ? -1.5 : 0.3, 0, 2]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={scene} />
      {place === "delivery" && <CarryBasket />}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
          <ringGeometry args={[0.35, 0.41, 48]} />
          <meshBasicMaterial color="#f5bd50" transparent opacity={0.95} />
        </mesh>
      )}
      {labels && selected && (
        <Html position={[0, 2, 0]} center zIndexRange={[5, 0]}>
          <span className="bakery-person-label">{names[id]}</span>
        </Html>
      )}
    </group>
  );
}
function CarryBasket() {
  const g = useGLTF(bakeryAssets.carry);
  const s = useMemo(() => g.scene.clone(true), [g.scene]);
  return <primitive object={s} position={[0, 0.85, 0.42]} />;
}
export default function BakeryScene({
  beat,
  selected,
  onSelect,
  onPlace,
  evening = false,
  labels = true,
  paused = false,
  onReady,
}: {
  beat: SceneBeat;
  selected: BakeryPerson | "wide" | "auto";
  onSelect: (id: BakeryPerson) => void;
  onPlace: (place: BakeryPlace) => void;
  evening?: boolean;
  labels?: boolean;
  paused?: boolean;
  onReady: () => void;
}) {
  const arrivals = useRef({ key: "", ids: new Set<string>() });
  const key = beat.label + beat.ahe + beat.xiaoman;
  if (arrivals.current.key !== key) arrivals.current = { key, ids: new Set() };
  function arrived(id: string) {
    arrivals.current.ids.add(id);
    if (arrivals.current.ids.size === 2) onReady();
  }
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [11, 13, 16], zoom: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <Camera focus={selected} beat={beat} />
      <hemisphereLight
        args={[evening ? "#ffe0b3" : "#fff4d5", "#7c8b78", 2.1]}
      />
      <directionalLight
        position={[-5, 12, 7]}
        intensity={evening ? 3.4 : 3.1}
        color={evening ? "#ffb76f" : "#fff0cd"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[6, 6, -5]} color="#c6e8f3" intensity={1.3} />
      <Suspense
        fallback={
          <Html center>
            <span className="bakery-load">正在点亮面包房…</span>
          </Html>
        }
      >
        <Environment
          onPlace={onPlace}
          active={
            beat.active &&
            [beat.ahe, beat.xiaoman].some((p) => p === "knead" || p === "oven")
          }
          paused={paused}
        />
        <Person
          id="ahe"
          beatKey={key}
          onArrive={() => arrived("ahe")}
          place={beat.ahe}
          active={beat.active}
          paused={paused}
          selected={selected === "ahe"}
          onSelect={() => onSelect("ahe")}
          labels={labels}
        />
        <Person
          id="xiaoman"
          beatKey={key}
          onArrive={() => arrived("xiaoman")}
          place={beat.xiaoman}
          active={beat.active}
          paused={paused}
          selected={selected === "xiaoman"}
          onSelect={() => onSelect("xiaoman")}
          labels={labels}
        />
      </Suspense>
    </Canvas>
  );
}
