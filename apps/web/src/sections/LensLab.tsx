import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { clsx } from "clsx";
import { SplitText } from "../components/motion";

const LENSES = [
  { id: "amber", name: "Amber", hex: "#c8892b", note: "Boosts contrast in flat light." },
  { id: "g15", name: "G-15", hex: "#3f5e45", note: "True-to-life colour, all day." },
  { id: "rose", name: "Rosé", hex: "#d98c8c", note: "Warms skin, softens shadows." },
  { id: "smoke", name: "Smoke", hex: "#3a3f44", note: "Maximum dimming for bright sun." },
  { id: "azure", name: "Azure Mirror", hex: "#4f86c6", note: "Mirror coat bounces glare away." },
] as const;

const LENS_PATH = "M8 12C22 2 80 1 95 11c8 19-2 58-34 66C33 83 7 64 4 33 3 22 4 16 8 12Z";
const LENS_W = 360;
const LENS_H = 290;

/** A painted coastline at noon, built from gradients only (no image weight). */
function Scene({ glare, className }: { glare: boolean; className?: string }) {
  return (
    <div className={clsx("absolute inset-0", className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#9cc3dd 0%,#d9e4dc 38%,#f6d6a8 54%,#f2b27a 58%)" }} />
      <div className="absolute left-[62%] top-[30%] h-40 w-40 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle,#fffaf0 0%,#fff2cf 30%,rgba(255,236,190,0) 70%)" }} />
      {/* cliffs */}
      <div className="absolute bottom-[42%] left-[-5%] h-[26%] w-[42%]" style={{ background: "#6f5a48", clipPath: "polygon(0 100%,0 30%,18% 12%,35% 22%,52% 0,70% 30%,86% 38%,100% 100%)" }} />
      <div className="absolute bottom-[42%] left-[8%] h-[16%] w-[30%]" style={{ background: "#8a6e55", clipPath: "polygon(0 100%,10% 40%,30% 20%,55% 45%,75% 30%,100% 100%)" }} />
      {/* sea */}
      <div className="absolute inset-x-0 bottom-0 top-[58%]" style={{ background: "linear-gradient(180deg,#5d97b3 0%,#2f6a8a 40%,#13394f 100%)" }} />
      {/* sun path on the water */}
      <div className="absolute bottom-[8%] left-[62%] top-[58%] w-[22%] -translate-x-1/2" style={{ background: "linear-gradient(180deg,rgba(255,246,220,.95),rgba(255,236,200,.25) 60%,transparent)", filter: "blur(6px)", opacity: glare ? 1 : 0.18 }} />
      {glare && <Sparkles />}
      {/* boat */}
      <div className="absolute bottom-[34%] left-[26%] h-3 w-14 rounded-b-full bg-[#f4efe6]" />
      <div className="absolute bottom-[35%] left-[28.5%] h-10 w-[2px] bg-[#f4efe6]" />
    </div>
  );
}

function Sparkles() {
  const dots = useRef(
    Array.from({ length: 70 }, (_, i) => ({
      left: 46 + Math.sin(i * 12.9898) * 22 + ((i * 7) % 11),
      top: 60 + ((i * 37) % 38),
      w: 6 + ((i * 13) % 22),
      d: (i % 9) * 0.23,
    })),
  ).current;
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-[3px] rounded-full bg-white"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.w,
            boxShadow: "0 0 10px 3px rgba(255,255,255,.8)",
            animation: `twinkle 1.8s ${d.d}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`@keyframes twinkle{0%,100%{opacity:.15;transform:scaleX(.6)}50%{opacity:1;transform:scaleX(1)}}`}</style>
    </>
  );
}

export function LensLab() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<(typeof LENSES)[number]>(LENSES[0]);
  const [polarized, setPolarized] = useState(true);
  const [size, setSize] = useState({ w: 1200, h: 640 });
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const x = useSpring(tx, { stiffness: 140, damping: 22, mass: 0.6 });
  const y = useSpring(ty, { stiffness: 140, damping: 22, mass: 0.6 });
  const innerX = useTransform(x, (v) => -v);
  const innerY = useTransform(y, (v) => -v);
  const lastInteraction = useRef(0);
  const scale = size.w < 640 ? 0.62 : 1;
  const lw = LENS_W * scale;
  const lh = LENS_H * scale;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    tx.set(size.w * 0.55 - lw / 2);
    ty.set(size.h * 0.5 - lh / 2);
  }, [size, lw, lh, tx, ty]);

  // Idle: the lens drifts across the glare by itself until someone takes over.
  useAnimationFrame((t) => {
    if (reduce || performance.now() - lastInteraction.current < 2500) return;
    const s = t / 1000;
    tx.set(size.w * (0.5 + 0.22 * Math.sin(s * 0.45)) - lw / 2);
    ty.set(size.h * (0.55 + 0.12 * Math.sin(s * 0.7)) - lh / 2);
  });

  const follow = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    lastInteraction.current = performance.now();
    tx.set(Math.max(-lw * 0.3, Math.min(r.width - lw * 0.7, clientX - r.left - lw / 2)));
    ty.set(Math.max(-lh * 0.3, Math.min(r.height - lh * 0.7, clientY - r.top - lh / 2)));
  };

  const mask = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 80' preserveAspectRatio='none'><path d='${LENS_PATH}'/></svg>")`;

  return (
    <section id="lens-lab" className="px-4 py-28 sm:px-8 md:py-40" aria-labelledby="lens-lab-title">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">Lens lab</p>
            <SplitText as="h2" by="word" text="Glare is a choice." className="mt-4 block font-serif text-mega" />
            <p id="lens-lab-title" className="mt-5 max-w-xl text-mute">
              Move the lens across the water. Switch tints, then turn polarization off to see the glare your customers will no longer squint through.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:items-end">
            <div role="radiogroup" aria-label="Lens tint" className="flex flex-wrap gap-1 rounded-full border hairline p-1">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={lens.id === l.id}
                  onClick={() => setLens(l)}
                  className="relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium sm:text-sm"
                >
                  {lens.id === l.id && <motion.span layoutId="lens-pill" className="absolute inset-0 rounded-full bg-bone" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  <span className="relative h-3 w-3 rounded-full ring-1 ring-black/20" style={{ background: l.hex }} />
                  <span className={clsx("relative transition-colors", lens.id === l.id ? "text-ink" : "text-bone/80")}>{l.name}</span>
                </button>
              ))}
            </div>
            <button
              role="switch"
              aria-checked={polarized}
              onClick={() => setPolarized((p) => !p)}
              className="flex items-center gap-3 self-start text-sm md:self-end"
            >
              <span className={clsx("relative h-6 w-11 rounded-full border transition-colors duration-300", polarized ? "border-amber bg-amber" : "hairline bg-ink-3")}>
                <motion.span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-bone" animate={{ left: polarized ? 22 : 3 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </span>
              Polarized {polarized ? "on" : "off"}
            </button>
          </div>
        </div>

        <div
          ref={box}
          className="relative mt-12 h-[62svh] min-h-[420px] touch-none select-none overflow-hidden rounded-[32px]"
          onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons) && follow(e.clientX, e.clientY)}
          onPointerDown={(e) => follow(e.clientX, e.clientY)}
          data-cursor="drag"
          data-cursor-label="Move"
          role="img"
          aria-label={`Coastline at noon seen through a ${lens.name} lens, polarization ${polarized ? "on" : "off"}`}
        >
          <Scene glare />
          {/* Through the lens */}
          <motion.div className="absolute left-0 top-0 will-change-transform" style={{ x, y, width: lw, height: lh, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
            <motion.div className="absolute left-0 top-0" style={{ x: innerX, y: innerY, width: size.w, height: size.h }}>
              <Scene glare={!polarized} className="saturate-[1.25] contrast-[1.12]" />
              <motion.div className="absolute inset-0 mix-blend-multiply" animate={{ backgroundColor: lens.hex }} transition={{ duration: 0.6 }} style={{ opacity: 0.78 }} />
              {lens.id === "azure" && <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-cyan-200/10" />}
            </motion.div>
            {/* glass sheen */}
            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0)_32%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.12)_100%)]" />
          </motion.div>
          {/* rim */}
          <motion.svg className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ x, y, width: lw, height: lh }} viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden>
            <path d={LENS_PATH} fill="none" stroke="#d8b26a" strokeWidth={2.5} vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,.35))" }} />
          </motion.svg>
          <div className="pointer-events-none absolute bottom-5 left-5 rounded-full bg-ink/60 px-4 py-2 text-xs text-bone backdrop-blur-md">
            <span className="font-medium">{lens.name}</span> <span className="text-bone/60">— {lens.note}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
