import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { EASE_OUT, SplitText, useScrollTo } from "../components/motion";
import { InstallButton } from "../components/Install";
import type { GlassesSpec } from "../three/Sunglasses";

const HeroCanvas = lazy(() => import("../three/HeroCanvas"));

const TINTS = [
  { word: "Amber", glow: "#c8892b", lens: "#c8892b", finish: "gradient", frame: "Gold", frameHex: "#c9a14a", label: "Amber Gradient", tech: "UV400 · Gradient" },
  { word: "Verde", glow: "#4d6b52", lens: "#2f4a35", finish: "solid", frame: "Gunmetal", frameHex: "#4a4d52", label: "G-15 Green", tech: "Polarized · UV400" },
  { word: "Rosé", glow: "#d98c8c", lens: "#d98c8c", finish: "gradient", frame: "Rose Gold", frameHex: "#c98f7a", label: "Rosé Gradient", tech: "UV400 · Gradient" },
  { word: "Azure", glow: "#4f86c6", lens: "#3a6ea5", finish: "mirror", frame: "Silver", frameHex: "#b9bcc2", label: "Azure Mirror", tech: "Polarized · Mirrored" },
] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { margin: "200px" });
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [tint, setTint] = useState(0);
  const [outro, setOutro] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [mountCanvas, setMountCanvas] = useState(false);
  const [intro, setIntro] = useState(false);
  const scrollTo = useScrollTo();

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setTint(Math.min(3, Math.max(0, Math.floor((p / 0.82) * 4))));
    setOutro(p > 0.86);
  });

  // Mount WebGL after first paint so the poster + headline own LCP.
  useEffect(() => {
    if (reduce) return;
    const mount = window.setTimeout(() => setMountCanvas(true), 350);
    const t = window.setTimeout(() => setIntro(true), 120);
    return () => {
      clearTimeout(mount);
      clearTimeout(t);
    };
  }, [reduce]);

  const t = TINTS[tint]!;
  const spec: GlassesSpec = { style: "aviator", material: "metal", frameColor: t.frame, frameHex: t.frameHex, lensHex: t.lens, finish: t.finish, seed: "riviera" };
  const headlineY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const progressScale = useTransform(scrollYProgress, [0, 0.82], [0, 1]);

  return (
    <section ref={section} aria-label="Introduction" className={reduce ? "relative h-[100svh]" : "relative h-[420svh] md:h-[460vh]"}>
      <div ref={stage} className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Tint glow (stacked layers, only opacity animates) */}
        {TINTS.map((x, i) => (
          <motion.div
            key={x.word}
            aria-hidden
            className="absolute inset-0"
            style={{ background: `radial-gradient(60% 55% at 50% 56%, ${x.glow}55 0%, ${x.glow}14 45%, transparent 75%)` }}
            animate={{ opacity: i === tint ? 1 : 0 }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
          />
        ))}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink to-transparent" />

        {/* Headline, behind the frame */}
        <motion.div style={reduce ? undefined : { y: headlineY }} className="absolute inset-x-0 top-[17svh] flex flex-col items-center px-4 text-center md:top-[13vh]">
          <AnimatePresence mode="wait" initial={false}>
            {!outro ? (
              <motion.div key="see" className="flex flex-col items-center" exit={{ opacity: 0, y: -30, transition: { duration: 0.5 } }}>
                <SplitText as="p" text="See the world in" trigger={reduce ? true : intro} className="font-serif text-[clamp(1.8rem,5vw,4.6rem)] leading-none text-bone/90" />
                <h1 className="sr-only">LUMEN — wholesale sunglasses, imported into your Shopify store in one click</h1>
                <div className="relative mt-1 h-[0.9em] w-full text-display font-serif italic" style={{ color: t.glow }} aria-hidden>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={t.word} className="absolute inset-x-0 flex justify-center">
                      {[...t.word].map((ch, i) => (
                        <span key={i} className="inline-block overflow-hidden pb-[0.1em]">
                          <motion.span
                            className="inline-block"
                            initial={{ y: "105%", rotate: 8 }}
                            animate={{ y: intro || reduce ? "0%" : "105%", rotate: 0, transition: { duration: 1, ease: EASE_OUT, delay: 0.25 + i * 0.045 } }}
                            exit={{ y: "-105%", rotate: -6, transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1], delay: i * 0.025 } }}
                          >
                            {ch}
                          </motion.span>
                        </span>
                      ))}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div key="now" className="flex translate-y-[30svh] flex-col items-center md:translate-y-[32vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SplitText as="p" text="Now selling in" trigger className="font-serif text-[clamp(1.8rem,5vw,4.6rem)] leading-none text-bone/90" />
                <SplitText as="p" text="your store." trigger delay={0.15} className="mt-1 text-display font-serif italic text-bone" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 3D frame (poster first, then WebGL) */}
        <div className="pointer-events-none absolute inset-0">
          <motion.img
            src="/products/hero-poster.webp"
            srcSet="/products/hero-poster.webp 900w, /products/hero-poster-lg.webp 1600w"
            sizes="(min-width: 768px) 60vw, 92vw"
            alt=""
            fetchPriority="high"
            className="absolute left-1/2 top-[38%] w-[88vw] max-w-[980px] -translate-x-1/2 -translate-y-1/2 md:top-[60%] md:w-[60vw]"
            animate={{ opacity: canvasReady ? 0 : 1 }}
            transition={{ duration: 0.8 }}
          />
          {mountCanvas && (
            <Suspense fallback={null}>
              <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: canvasReady ? 1 : 0 }} transition={{ duration: 1.2 }}>
                <HeroCanvas progress={scrollYProgress} spec={spec} active={inView} onReady={() => setCanvasReady(true)} />
              </motion.div>
            </Suspense>
          )}
        </div>

        {/* Top-left eyebrow */}
        <motion.p className="eyebrow absolute left-4 top-24 sm:left-8 sm:top-28" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1 }}>
          Wholesale eyewear <span className="text-bone/40">—</span> for Shopify stores
        </motion.p>

        {/* Bottom bar */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 px-4 pb-6 sm:px-8 sm:pb-8 md:flex-row md:items-end md:justify-between">
          <div className="min-h-[3.5rem]" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
                <p className="eyebrow">
                  <span className="text-bone">0{tint + 1}</span> / 04 · Lens
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-bone">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.glow }} />
                  {t.label} <span className="text-mute">— {t.tech}</span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="flex w-48 gap-1.5" aria-hidden>
              {TINTS.map((x, i) => (
                <ProgressSegment key={x.word} progress={progressScale} index={i} />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 md:items-end">
            <p className="max-w-xs text-sm leading-relaxed text-mute md:text-right">
              24 frames, imported into your Shopify store in one click. Stock and cost sync on their own. Your prices stay yours.
            </p>
            <div className="flex items-center gap-3">
              <InstallButton />
              <button onClick={() => scrollTo("#catalog")} className="link-underline px-2 py-3 text-sm text-bone/80 hover:text-bone">
                Browse frames
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressSegment({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const scaleX = useTransform(progress, [index / 4, (index + 1) / 4], [0, 1]);
  return (
    <div className="h-[2px] flex-1 overflow-hidden rounded bg-bone/15">
      <motion.div className="h-full origin-left bg-bone" style={{ scaleX }} />
    </div>
  );
}
