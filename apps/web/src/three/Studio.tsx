import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Light panels baked into a PMREM environment map. This replaces drei's <Environment>/<Lightformer>,
 * which pulls HDR/EXR loaders we never use (~3× the three.js chunk).
 */
export interface Panel {
  form: "rect" | "ring";
  intensity: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number] | number;
  color?: string;
}

/** Soft-box studio for product shots: overhead strip, two side panels, a diagonal glare strip, a dim wraparound fill. */
export const STUDIO: Panel[] = [
  { form: "rect", intensity: 2.6, position: [0, 5, 0], rotation: [Math.PI / 2, 0, 0], scale: [10, 3] },
  { form: "rect", intensity: 1.8, position: [-5, 1, 0], rotation: [0, Math.PI / 2, 0], scale: [6, 4] },
  { form: "rect", intensity: 1.4, position: [5, 1, 0], rotation: [0, -Math.PI / 2, 0], scale: [6, 4], color: "#ffe9cc" },
  { form: "rect", intensity: 2.2, position: [-1.2, 1.2, 6], rotation: [0, 0, -0.75], scale: [0.6, 9] },
  { form: "ring", intensity: 1.1, position: [0, 0, -6], scale: 14, color: "#a39d94" },
];

/** Darker, moodier rig for the hero (dark page), with two glare strips the hero rotates across the lenses. */
export const NIGHT: Panel[] = [
  { form: "rect", intensity: 2.4, position: [0, 5, 0], rotation: [Math.PI / 2, 0, 0], scale: [10, 2.5] },
  { form: "rect", intensity: 1.6, position: [-5, 0.5, 1], rotation: [0, Math.PI / 2, 0], scale: [5, 3], color: "#ffe2b8" },
  { form: "rect", intensity: 1.2, position: [5, 0.5, 1], rotation: [0, -Math.PI / 2, 0], scale: [5, 3] },
  { form: "rect", intensity: 3, position: [-1.2, 1.2, 6], rotation: [0, 0, -0.7], scale: [0.6, 10] },
  { form: "rect", intensity: 1.6, position: [2.5, 0.8, 6], rotation: [0, 0, -0.7], scale: [0.25, 10] },
  { form: "ring", intensity: 0.5, position: [0, 0, -6], scale: 14, color: "#8a8278" },
];

export function EnvironmentPanels({ panels, intensity = 1 }: { panels: Panel[]; intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const env = new THREE.Scene();
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    for (const p of panels) {
      const geo = p.form === "ring" ? new THREE.RingGeometry(0.5, 1, 64) : new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color ?? "#ffffff").multiplyScalar(p.intensity * intensity), side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.position);
      if (p.rotation) mesh.rotation.set(...p.rotation);
      const s = typeof p.scale === "number" ? [p.scale, p.scale] : p.scale;
      mesh.scale.set(s[0]!, s[1]!, 1);
      env.add(mesh);
      geos.push(geo);
      mats.push(mat);
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(env, 0.03);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    };
  }, [gl, scene, panels, intensity]);
  return null;
}

export function StudioLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <ambientLight intensity={0.45 * intensity} />
      <EnvironmentPanels panels={STUDIO} intensity={intensity} />
    </>
  );
}
