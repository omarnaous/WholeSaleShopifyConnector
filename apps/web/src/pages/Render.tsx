import { Canvas, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { Style } from "@lumen/core";
import { Sunglasses, type LensFinish } from "../three/Sunglasses";
import { StudioLights } from "../three/Studio";

/**
 * Headless product-shot renderer, e.g.
 * /render?style=aviator&material=metal&frame=Gold&frameHex=%23c9a14a&lens=%232f4a35&finish=solid&seed=riviera
 * scripts/render-products.ts screenshots this page for every catalog variant.
 */
export default function Render() {
  const q = new URLSearchParams(location.search);
  const view = q.get("view") ?? "three-quarter";
  const front = view === "front";
  // The site's global CSS paints html/body ink; product shots need a truly transparent page.
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);
  return (
    <div style={{ width: "100vw", height: "100vh", background: q.get("bg") ?? "transparent" }}>
      <Canvas
        shadows
        dpr={Number(q.get("dpr") ?? 2)}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        camera={{ position: front ? [0, 0.1, 3.6] : [1.95, 0.62, 2.8], fov: 26 }}
        onCreated={({ camera }) => camera.lookAt(front ? 0 : 0.05, -0.08, front ? 0 : -0.5)}
      >
        <StudioLights />
        <Sunglasses
          instant
          position={[0, 0, front ? 0 : 0.2]}
          rotation={[0.04, front ? 0 : -0.12, 0]}
          spec={{
            style: (q.get("style") ?? "aviator") as Style,
            material: q.get("material") ?? "metal",
            frameColor: q.get("frame") ?? "Gold",
            frameHex: q.get("frameHex") ?? "#c9a14a",
            lensHex: q.get("lens") ?? "#2f4a35",
            finish: (q.get("finish") ?? "solid") as LensFinish,
            seed: q.get("seed") ?? "",
          }}
        />
        <ReadySignal />
      </Canvas>
    </div>
  );
}

/** Flags window.__ready after a few frames so the screenshot script knows the shot is settled. */
function ReadySignal() {
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 8) (window as unknown as { __ready: boolean }).__ready = true;
  });
  return null;
}
