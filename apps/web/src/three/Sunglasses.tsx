import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import type { Style } from "@lumen/core";
import {
  acetateBridgeGeometry,
  acetateRimGeometry,
  lensCenterX,
  lensGeometry,
  lensOutline,
  metalRimGeometry,
  paramsFor,
  templeGeometry,
  tortoiseTexture,
  tubeAlong,
  wrapGeometry,
  type FrameParams,
} from "./geometry";

import type { LensFinish } from "../lib/finish";
export type { LensFinish } from "../lib/finish";

export interface GlassesSpec {
  style: Style;
  material: string;
  frameColor: string;
  frameHex: string;
  lensHex: string;
  finish: LensFinish;
  seed?: string;
}

export { finishFor } from "../lib/finish";

interface Parts {
  frame: THREE.BufferGeometry[];
  lenses: { geometry: THREE.BufferGeometry; outline: THREE.Vector2[]; offsetX: number }[];
  metal: THREE.BufferGeometry[];
}

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const mirror = (pts: THREE.Vector2[]) => pts.map((p) => v2(-p.x, p.y)).reverse();

function buildParts(p: FrameParams): Parts {
  const frame: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const lenses: Parts["lenses"] = [];
  const depth = p.build === "metal" ? 0.02 : p.style === "wayfarer" ? 0.075 : 0.06;
  const base = lensOutline(p);
  const cx = lensCenterX(p);
  const zAt = (x: number) => -p.wrap * x * x;
  const frameParts = p.build === "metal" ? metal : frame;

  const sides: (1 | -1)[] = p.style === "shield" ? [1] : [1, -1];
  let hingeR = v2(0, 0);
  for (const side of sides) {
    const local = side === 1 ? base : mirror(base);
    const world = local.map((q) => v2(q.x + side * cx, q.y));
    // Lens
    lenses.push({ geometry: null as never, outline: world, offsetX: 0 });
    // Rim
    if (p.build === "metal" || p.style === "shield") {
      if (p.style !== "shield") frameParts.push(wrapGeometry(metalRimGeometry(world, p.rim), p.wrap));
    } else {
      const { geometry, outer } = acetateRimGeometry(world, p, depth);
      frame.push(wrapGeometry(geometry, p.wrap));
      if (side === 1) hingeR = outer.reduce((best, q) => (q.y > -0.02 && q.x > best.x ? q : best), v2(-9, 0));
    }
    if (side === 1 && (p.build === "metal" || p.style === "shield")) hingeR = world.reduce((best, q) => (q.y > 0 && q.x > best.x ? q : best), v2(-9, 0));
  }

  const yMax = Math.max(...base.map((q) => q.y));

  if (p.style === "shield") {
    // Brow bar riding just above the top edge of the shield.
    const top = base.filter((q) => q.y > yMax * 0.55).sort((a, b) => a.x - b.x);
    const brow = top.map((q) => new THREE.Vector3(q.x, q.y + 0.01, zAt(q.x) + 0.01));
    frameParts.push(tubeAlong(brow, 0.02, 80));
    const pads = [-1, 1].map((s) => new THREE.SphereGeometry(0.035, 16, 12).scale(0.6, 1, 0.5).translate(s * 0.07, -0.07, -0.05));
    frame.push(...pads);
  } else if (p.build === "metal") {
    // Aviator double bridge.
    const innerTop = base.reduce((best, q) => (q.x < best.x + 0.0001 && q.y > 0 ? q : best), v2(9, 0));
    const xIn = cx + Math.min(...base.map((q) => q.x)) + 0.03;
    const yTop = yMax - 0.015;
    const topBar = [-1, -0.5, 0, 0.5, 1].map((t) => new THREE.Vector3(t * (cx - p.lensW * 0.18), yTop + 0.01 + 0.01 * (1 - t * t), zAt(t * cx) + 0.005));
    metal.push(tubeAlong(topBar, p.rim * 0.9));
    const yBridge = innerTop.y * 0.35 + 0.04;
    const low = [-1, -0.5, 0, 0.5, 1].map((t) => new THREE.Vector3(t * xIn, yBridge + 0.045 * (1 - t * t), zAt(t * xIn)));
    metal.push(tubeAlong(low, p.rim * 0.9));
    // Nose pads on little wire arms.
    for (const s of [-1, 1]) {
      const pad = new THREE.SphereGeometry(0.04, 16, 12).scale(0.45, 1, 0.3).rotateY(s * 0.5).translate(s * (xIn + 0.035), -0.04, -0.07);
      frame.push(pad);
      metal.push(tubeAlong([new THREE.Vector3(s * xIn, yBridge, zAt(xIn)), new THREE.Vector3(s * (xIn + 0.02), 0.0, -0.04), new THREE.Vector3(s * (xIn + 0.035), -0.03, -0.065)], 0.005, 12));
    }
  } else {
    const innerTopY = Math.max(...base.filter((q) => q.x < -p.lensW * 0.3).map((q) => q.y));
    frame.push(acetateBridgeGeometry(p, innerTopY + p.rim, depth));
  }

  // Hinges + temples
  for (const side of [1, -1] as const) {
    const hx = side * (hingeR.x + (p.style === "shield" ? cx : 0));
    const hy = hingeR.y * 0.85;
    const hz = zAt(hx) - 0.02;
    if (p.build === "metal") {
      metal.push(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 12).rotateX(Math.PI / 2).translate(hx, hy, hz - 0.03));
    } else {
      frame.push(new THREE.BoxGeometry(0.05, p.style === "wayfarer" ? 0.085 : 0.065, 0.12).translate(hx - side * 0.01, hy, hz - 0.04));
    }
    const temple = templeGeometry(new THREE.Vector3(hx, hy, hz - 0.08), side, p);
    if (p.build === "metal") metal.push(temple);
    else frame.push(temple);
  }

  return { frame, metal, lenses };
}

/**
 * Analytic normals for the wrapped lens (z = -wrap·x²), at reduced tilt. Recomputed mesh normals bunch up
 * and turn the glare strip into a tiny dirt-like blob; these keep the reflection a clean, wide streak.
 */
function lensNormals(g: THREE.BufferGeometry, wrap: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(2 * wrap * pos.getX(i) * 0.6, 0, 1).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  return g;
}

const tmp = new THREE.Color();
const colorDelta = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

export function Sunglasses({ spec, quality = "high", instant = false, ...group }: { spec: GlassesSpec; quality?: "high" | "low"; instant?: boolean } & ThreeElements["group"]) {
  const params = useMemo(() => paramsFor(spec.style, spec.material, spec.seed), [spec.style, spec.material, spec.seed]);
  const parts = useMemo(() => {
    const built = buildParts(params);
    const tint = new THREE.Color(spec.lensHex);
    built.lenses = built.lenses.map((l) => ({
      ...l,
      geometry: lensNormals(wrapGeometry(lensGeometry(l.outline, { gradient: true, tint, curvature: 0 }), params.wrap), params.wrap),
    }));
    return built;
    // Lens tint is animated separately; geometry only depends on the frame shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const isMetal = params.build === "metal";
  const crystal = /crystal/i.test(spec.frameColor);
  const tortoise = /tortoise/i.test(spec.frameColor);

  const frameMat = useMemo(() => {
    if (crystal)
      return new THREE.MeshPhysicalMaterial({
        color: "#eef3f4",
        roughness: 0.06,
        transmission: quality === "high" ? 1 : 0,
        thickness: 0.25,
        ior: 1.48,
        transparent: true,
        opacity: quality === "high" ? 1 : 0.5,
        clearcoat: 1,
      });
    return new THREE.MeshPhysicalMaterial({
      color: tortoise ? "#ffffff" : spec.frameHex,
      map: tortoise ? tortoiseTexture() : null,
      roughness: /matte/i.test(spec.frameColor) ? 0.62 : 0.24,
      clearcoat: /matte/i.test(spec.frameColor) ? 0 : 1,
      clearcoatRoughness: 0.06,
      metalness: 0,
    });
    // Recreate only when the kind of material changes; plain colour changes are lerped below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crystal, tortoise, quality, /matte/i.test(spec.frameColor)]);

  const metalMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: isMetal ? spec.frameHex : "#b9bcc2", metalness: 1, roughness: 0.2, envMapIntensity: 1.4 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMetal],
  );

  const lensMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        roughness: 0.03,
        metalness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 0.2,
        iridescenceIOR: 1.7,
        envMapIntensity: 2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  // Animated state: current tint / finish chase their targets (smooth tint swaps).
  const cur = useRef({ tint: new THREE.Color(spec.lensHex), mirror: spec.finish === "mirror" ? 1 : 0, gradient: spec.finish === "gradient" ? 1 : 0, dirty: true });
  const light = useMemo(() => new THREE.Color("#f3ece0"), []);

  const writeLensColors = () => {
    const { tint, gradient } = cur.current;
    for (const l of parts.lenses) {
      const pos = l.geometry.attributes.position as THREE.BufferAttribute;
      const col = l.geometry.attributes.color as THREE.BufferAttribute;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - minY) / (maxY - minY || 1);
        const mix = THREE.MathUtils.lerp(1, THREE.MathUtils.smoothstep(t, 0.05, 0.85), gradient);
        tmp.copy(light).lerp(tint, mix);
        col.setXYZW(i, tmp.r, tmp.g, tmp.b, THREE.MathUtils.lerp(1, 0.38 + 0.6 * mix, gradient));
      }
      col.needsUpdate = true;
    }
  };

  useEffect(() => {
    if (instant) {
      cur.current.tint.set(spec.lensHex);
      cur.current.mirror = spec.finish === "mirror" ? 1 : 0;
      cur.current.gradient = spec.finish === "gradient" ? 1 : 0;
      if (!crystal && !tortoise) frameMat.color.set(spec.frameHex);
      if (isMetal) metalMat.color.set(spec.frameHex);
    }
    cur.current.dirty = true;
  }, [spec.lensHex, spec.finish, spec.frameHex, instant, crystal, tortoise, frameMat, metalMat, isMetal]);

  const target = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const c = cur.current;
    const k = instant ? 1 : 1 - Math.exp(-dt * 5);
    target.set(spec.lensHex);
    const mirrorT = spec.finish === "mirror" ? 1 : 0;
    const gradT = spec.finish === "gradient" ? 1 : 0;
    const moving = colorDelta(c.tint, target) > 0.002 || Math.abs(c.mirror - mirrorT) > 0.002 || Math.abs(c.gradient - gradT) > 0.002;
    if (moving || c.dirty) {
      c.tint.lerp(target, k);
      c.mirror += (mirrorT - c.mirror) * k;
      c.gradient += (gradT - c.gradient) * k;
      writeLensColors();
      lensMat.metalness = 0.2 + 0.75 * c.mirror;
      lensMat.roughness = 0.03 + 0.02 * c.mirror;
      lensMat.iridescence = 0.15 + 0.85 * c.mirror;
      lensMat.opacity = 0.88 + 0.1 * c.mirror;
      // Mirror coats need to read as coloured metal even against a dark room.
      lensMat.emissive.copy(c.tint).multiplyScalar(0.28 * c.mirror);
      c.dirty = false;
    }
    if (!crystal && !tortoise) frameMat.color.lerp(target.set(spec.frameHex), k);
    if (isMetal) metalMat.color.lerp(target.set(spec.frameHex), k);
  });

  useEffect(
    () => () => {
      parts.frame.forEach((g) => g.dispose());
      parts.metal.forEach((g) => g.dispose());
      parts.lenses.forEach((l) => l.geometry.dispose());
    },
    [parts],
  );

  return (
    <group {...group}>
      {parts.frame.map((g, i) => (
        <mesh key={`f${i}`} geometry={g} material={frameMat} castShadow />
      ))}
      {parts.metal.map((g, i) => (
        <mesh key={`m${i}`} geometry={g} material={metalMat} castShadow />
      ))}
      {parts.lenses.map((l, i) => (
        <mesh key={`l${i}`} geometry={l.geometry} material={lensMat} renderOrder={2} />
      ))}
    </group>
  );
}
