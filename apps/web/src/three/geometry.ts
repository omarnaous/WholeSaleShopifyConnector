import * as THREE from "three";
import type { Style } from "@lumen/core";

/**
 * Procedural sunglasses. Units ≈ decimetres: a finished frame is ~1.4 wide.
 * The front sits in the XY plane facing +Z; temples run toward -Z.
 */

export interface FrameParams {
  style: Style;
  lensW: number;
  lensH: number;
  bridge: number;
  rim: number;
  /** "metal" = thin wire rims (tube), "acetate" = thick extruded front. */
  build: "metal" | "acetate";
  /** Face-form curvature: z -= wrap * x² */
  wrap: number;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function paramsFor(style: Style, material: string, seed = ""): FrameParams {
  const r = (hash(seed) % 1000) / 1000; // 0..1, stable per product
  const metal = material === "metal" || material === "titanium";
  const base: Record<Style, Omit<FrameParams, "style" | "build">> = {
    aviator: { lensW: 0.58 + r * 0.05, lensH: 0.5 + r * 0.04, bridge: 0.15, rim: 0.014, wrap: 0.12 },
    wayfarer: { lensW: 0.5 + r * 0.04, lensH: 0.38 + r * 0.03, bridge: 0.2, rim: 0.04, wrap: 0.16 },
    round: { lensW: 0.46 + r * 0.04, lensH: 0.45 + r * 0.04, bridge: 0.19, rim: 0.03, wrap: 0.1 },
    "cat-eye": { lensW: 0.54 + r * 0.05, lensH: 0.4 + r * 0.03, bridge: 0.19, rim: 0.04, wrap: 0.14 },
    shield: { lensW: 1.28 + r * 0.06, lensH: 0.46 + r * 0.04, bridge: 0, rim: 0.016, wrap: 0.26 },
    square: { lensW: 0.54 + r * 0.06, lensH: 0.46 + r * 0.05, bridge: 0.19, rim: 0.038, wrap: 0.13 },
  };
  return { style, build: metal ? "metal" : "acetate", ...base[style], rim: metal ? 0.014 : base[style].rim };
}

const N = 96; // outline resolution

/** Outline of the RIGHT lens (viewer's right, +x side), centred at origin, counter-clockwise. */
export function lensOutline(p: FrameParams): THREE.Vector2[] {
  const a = p.lensW / 2;
  const b = p.lensH / 2;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const n = { aviator: 2.3, wayfarer: 3.4, round: 2.05, "cat-eye": 3, shield: 3.2, square: 4.2 }[p.style];
    let x = a * Math.sign(c) * Math.abs(c) ** (2 / n);
    let y = b * Math.sign(s) * Math.abs(s) ** (2 / n);
    const u = x / a; // -1 inner (nose) … +1 outer (temple)
    const v = y / b; // -1 bottom … +1 top

    switch (p.style) {
      case "aviator":
        // Flat brow, deep teardrop belly that leans toward the nose.
        y += 0.05 * Math.max(0, v) * (1 - u * u) * -0.6;
        if (v < 0) y -= b * 0.34 * -v * (1 - 0.55 * (u + 1) * 0.5) * (1 - 0.35 * u * u);
        x *= 1 + 0.1 * v;
        break;
      case "wayfarer":
        // Wider at the top and the outer top corner kicks up.
        x *= 1 + 0.14 * v;
        y += b * 0.16 * Math.max(0, u) ** 2 * Math.max(0, v + 0.3);
        break;
      case "cat-eye":
        x *= 1 + 0.12 * v;
        y += b * 0.55 * Math.max(0, u) ** 3 * Math.max(0, v + 0.1);
        if (v < 0) y += b * 0.12 * Math.max(0, u);
        break;
      case "square":
        x *= 1 + 0.05 * v;
        break;
      case "shield": {
        // One lens across both eyes with a nose notch.
        x = (p.lensW / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
        y = b * Math.sign(s) * Math.abs(s) ** (2 / n);
        const ux = x / (p.lensW / 2);
        if (y < 0) y += b * 0.75 * Math.exp(-((ux / 0.13) ** 2)) * Math.min(1, -y / b + 0.3);
        y += b * 0.08 * ux * ux; // outer corners lift
        break;
      }
      case "round":
        break;
    }
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

/** Offsets a closed polyline along its normals. amount(i) lets the brow be thicker than the bottom. */
export function offsetOutline(pts: THREE.Vector2[], amount: (v: THREE.Vector2, i: number) => number) {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const tangent = new THREE.Vector2().subVectors(next, prev).normalize();
    const normal = new THREE.Vector2(tangent.y, -tangent.x); // outward for CCW
    return p.clone().addScaledVector(normal, amount(p, i));
  });
}

export const lensCenterX = (p: FrameParams) => (p.style === "shield" ? 0 : p.bridge / 2 + p.lensW / 2);

/** Applies face-form wrap (and an optional extra z) to every vertex. */
export function wrapGeometry(g: THREE.BufferGeometry, wrap: number, opts: { recomputeNormals?: boolean } = {}) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) - wrap * x * x);
  }
  pos.needsUpdate = true;
  // Extrusions are non-indexed: recomputing would facet them. The bend is gentle enough to keep their normals.
  if (opts.recomputeNormals) g.computeVertexNormals();
  return g;
}

/**
 * Lens surface as concentric rings (not a fan) so it can bend smoothly and carry
 * a per-vertex RGBA tint (gradient lenses: tint at the top fading toward the bottom).
 */
export function lensGeometry(outline: THREE.Vector2[], opts: { gradient: boolean; tint: THREE.Color; curvature: number }) {
  const rings = 14;
  const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
  const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length;
  const minY = Math.min(...outline.map((p) => p.y));
  const maxY = Math.max(...outline.map((p) => p.y));
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const light = opts.tint.clone().lerp(new THREE.Color("#f3ece0"), 0.55);

  positions.push(cx, cy, 0);
  pushColor(cy);
  uvs.push(0.5, 0.5);
  for (let r = 1; r <= rings; r++) {
    const k = r / rings;
    for (const p of outline) {
      const x = cx + (p.x - cx) * k;
      const y = cy + (p.y - cy) * k;
      // Spherical-ish base curve: centre bulges toward the viewer.
      const z = opts.curvature * (1 - k * k);
      positions.push(x, y, z);
      pushColor(y);
      uvs.push(0.5 + (p.x - cx) * k, 0.5 + (p.y - cy) * k);
    }
  }
  const n = outline.length;
  for (let i = 0; i < n; i++) index.push(0, 1 + i, 1 + ((i + 1) % n));
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * n;
    const b0 = 1 + r * n;
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      index.push(a0 + i, b0 + i, b0 + i1, a0 + i, b0 + i1, a0 + i1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;

  /** Vertex colour carries the tint (material colour stays white); gradient lenses fade to a light, more transparent bottom. */
  function pushColor(y: number) {
    if (!opts.gradient) {
      colors.push(opts.tint.r, opts.tint.g, opts.tint.b, 1);
      return;
    }
    const t = (y - minY) / (maxY - minY || 1); // 0 bottom … 1 top
    const mix = THREE.MathUtils.smoothstep(t, 0.05, 0.85);
    const c = light.clone().lerp(opts.tint, mix);
    colors.push(c.r, c.g, c.b, 0.38 + 0.6 * mix);
  }
}

/** Extruded acetate rim (ring with a lens hole). Thicker at the brow for wayfarer / cat-eye / square. */
export function acetateRimGeometry(outline: THREE.Vector2[], p: FrameParams, depth: number) {
  const browBoost = p.style === "wayfarer" ? 0.7 : p.style === "cat-eye" ? 0.8 : p.style === "square" ? 0.35 : 0.1;
  const b = p.lensH / 2;
  const outer = offsetOutline(outline, (v) => p.rim * (1 + browBoost * Math.max(0, v.y / b) ** 1.5));
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path([...outline].reverse()));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 4, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return { geometry: g, outer };
}

/** Wire rim for metal frames. */
export function metalRimGeometry(outline: THREE.Vector2[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(
    outline.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    true,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, outline.length * 2, radius, 10, true);
}

export function tubeAlong(points: THREE.Vector3[], radius: number, segments = 48) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, "centripetal"), segments, radius, 10, false);
}

/** Temple arm: a flat bar (acetate) or a thin wire with a tip (metal) along a bent path. */
export function templeGeometry(start: THREE.Vector3, side: 1 | -1, p: FrameParams) {
  const pts = [
    start.clone(),
    start.clone().add(new THREE.Vector3(side * 0.02, 0, -0.35)),
    start.clone().add(new THREE.Vector3(side * 0.035, -0.005, -0.85)),
    start.clone().add(new THREE.Vector3(side * 0.02, -0.04, -1.12)),
    start.clone().add(new THREE.Vector3(side * -0.01, -0.2, -1.32)),
  ];
  if (p.build === "metal") return tubeAlong(pts, 0.011, 64);
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const h = p.style === "wayfarer" || p.style === "square" ? 0.075 : 0.055;
  const w = 0.026;
  const profile = new THREE.Shape([new THREE.Vector2(-h / 2, -w / 2), new THREE.Vector2(h / 2, -w / 2), new THREE.Vector2(h / 2, w / 2), new THREE.Vector2(-h / 2, w / 2)]);
  return new THREE.ExtrudeGeometry(profile, { steps: 64, bevelEnabled: false, extrudePath: curve });
}

/** Wayfarer/acetate keyhole bridge between the two rims. */
export function acetateBridgeGeometry(p: FrameParams, yTop: number, depth: number) {
  const half = p.bridge / 2 + p.rim * 0.6;
  const thick = p.rim * (p.style === "round" ? 0.7 : 1.05);
  const top: THREE.Vector2[] = [];
  const bottom: THREE.Vector2[] = [];
  const arch = p.style === "round" ? 0.07 : 0.04;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = -half + t * 2 * half;
    const y = yTop - 0.02 + arch * Math.sin(Math.PI * t);
    top.push(new THREE.Vector2(x, y));
    bottom.push(new THREE.Vector2(x, y - thick));
  }
  const shape = new THREE.Shape([...bottom, ...top.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Tortoiseshell: warm amber base with irregular dark blotches. Generated once and cached. */
let tortoise: THREE.CanvasTexture | null = null;
export function tortoiseTexture() {
  if (tortoise) return tortoise;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#b06a2b";
  ctx.fillRect(0, 0, size, size);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 6 + rnd() * 38;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.35;
    g.addColorStop(0, dark ? "rgba(38,18,8,0.95)" : "rgba(214,150,70,0.8)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.6 + rnd()), r, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  tortoise = new THREE.CanvasTexture(c);
  tortoise.colorSpace = THREE.SRGBColorSpace;
  tortoise.wrapS = tortoise.wrapT = THREE.RepeatWrapping;
  tortoise.repeat.set(2.2, 2.2);
  return tortoise;
}
