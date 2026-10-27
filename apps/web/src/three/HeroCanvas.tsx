import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { Sunglasses, type GlassesSpec } from "./Sunglasses";
import { EnvironmentPanels, NIGHT } from "./Studio";

interface Props {
  progress: MotionValue<number>;
  spec: GlassesSpec;
  active: boolean;
  onReady?: () => void;
}

/**
 * Scroll-driven hero: the frame turns ~1 revolution across the section while the
 * environment's light strips slide over the lenses (the glare is a real reflection, not an overlay).
 */
export default function HeroCanvas({ progress, spec, active, onReady }: Props) {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  return (
    <Canvas
      dpr={mobile ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.05, 4.2], fov: 30 }}
      frameloop={active ? "always" : "never"}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      aria-hidden
    >
      <ambientLight intensity={0.25} />
      <EnvironmentPanels panels={NIGHT} />
      <EnvironmentSweep progress={progress} />
      <Rig progress={progress} spec={spec} mobile={mobile} onReady={onReady} />
    </Canvas>
  );
}

/**
 * Glare sweep: instead of re-rendering the environment every frame (6 cube faces + PMREM — too heavy),
 * the static environment is rotated, so its light strips slide across the lenses for free.
 */
function EnvironmentSweep({ progress }: { progress: MotionValue<number> }) {
  const scene = useThree((s) => s.scene);
  useFrame(({ clock }) => {
    const p = progress.get();
    scene.environmentRotation.set(0, Math.sin(p * Math.PI * 8) * 0.55 + Math.sin(clock.elapsedTime * 0.3) * 0.12, 0);
  });
  return null;
}

function Rig({ progress, spec, mobile, onReady }: { progress: MotionValue<number>; spec: GlassesSpec; mobile: boolean; onReady?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { size } = useThree();
  const frames = useRef(0);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const smooth = useRef({ p: 0, px: 0, py: 0 });
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    if (frames.current++ === 2) onReady?.();
    const s = smooth.current;
    const k = 1 - Math.exp(-dt * 6);
    s.p += (progress.get() - s.p) * k;
    s.px += (pointer.current.x - s.px) * k * 0.5;
    s.py += (pointer.current.y - s.py) * k * 0.5;
    const p = s.p;
    const t = clock.elapsedTime;

    // 0 → 0.8: one slow revolution while tints change; 0.8 → 1: settle front-on and drift up for the outro.
    const spin = THREE.MathUtils.smoothstep(p, 0.02, 0.82);
    g.rotation.y = -0.42 + spin * Math.PI * 2 + s.px * 0.18;
    g.rotation.x = 0.12 - Math.sin(spin * Math.PI) * 0.18 + s.py * 0.1 + Math.sin(t * 0.8) * 0.015;
    g.rotation.z = Math.sin(spin * Math.PI * 2) * 0.06;
    // Fit the ~1.45-wide frame to the visible width (portrait phones see far less than the vertical fov suggests).
    const visibleW = 2 * Math.tan(THREE.MathUtils.degToRad(15)) * 3.85 * (size.width / size.height);
    const base = Math.min(0.96, (visibleW * 0.84) / 1.45);
    const outro = THREE.MathUtils.smoothstep(p, 0.84, 1);
    g.scale.setScalar(base * (1 - outro * 0.35));
    // Sit between the headline and the bottom bar; lift and shrink away for the outro line.
    g.position.y = Math.sin(t * 0.9) * 0.025 + (mobile ? 0.16 : -0.24) + outro * (mobile ? 0.3 : 0.62);
    g.position.z = 0.35;
  });

  return (
    <group ref={group}>
      {/* Pivot through the middle of the frame, not the hinge plane */}
      <group position={[0, 0, 0.62]}>
        <Sunglasses spec={spec} quality={mobile ? "low" : "high"} />
      </group>
    </group>
  );
}
