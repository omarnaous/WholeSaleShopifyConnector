import { createContext, useContext, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import Lenis from "lenis";
import { cancelFrame, frame, motion, useInView, useMotionValue, useReducedMotion, useSpring, type Variants } from "motion/react";
import { clsx } from "clsx";
import { useLocation } from "react-router";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.76, 0, 0.24, 1] as const;

// ── Smooth scroll ────────────────────────────────────────────────────────────

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

/**
 * Lenis drives the real window scroll, so motion's useScroll keeps working untouched.
 * Its RAF is driven by motion's frame loop → one loop, no drift between scroll and scroll-linked animations.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  useEffect(() => {
    if (reduce) return;
    const l = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), touchMultiplier: 1.4, autoRaf: false });
    const update = (data: { timestamp: number }) => l.raf(data.timestamp);
    frame.update(update, true);
    setLenis(l);
    return () => {
      cancelFrame(update);
      l.destroy();
      setLenis(null);
    };
  }, [reduce]);
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

/** Scroll to an in-page anchor through Lenis (falls back to native). */
export function useScrollTo() {
  const lenis = useLenis();
  return (target: string) => {
    const el = document.querySelector(target);
    if (!el) return;
    if (lenis) lenis.scrollTo(el as HTMLElement, { offset: -20, duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth" });
  };
}

// ── Kinetic typography ───────────────────────────────────────────────────────

const lineV: Variants = { hidden: {}, show: {} };
const charV: Variants = {
  hidden: { y: "110%", rotate: 6 },
  show: (i: number) => ({ y: "0%", rotate: 0, transition: { duration: 1.1, ease: EASE_OUT, delay: i * 0.028 } }),
};

/**
 * Splits text into masked words/characters that rise into place when scrolled into view.
 * Screen readers get the plain string; the split spans are aria-hidden.
 */
export function SplitText({
  text,
  as: Tag = "span",
  className,
  by = "char",
  delay = 0,
  once = true,
  trigger,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  by?: "char" | "word";
  delay?: number;
  once?: boolean;
  /** Controlled mode: animate when true (ignores in-view). */
  trigger?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const show = trigger ?? inView;
  const words = text.split(" ");
  let i = Math.round(delay / 0.028);
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      <motion.span aria-hidden variants={lineV} initial={reduce ? "show" : "hidden"} animate={show ? "show" : "hidden"} className="inline">
        {words.map((w, wi) => (
          <span key={wi} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-top whitespace-nowrap">
            {by === "word" ? (
              <motion.span className="inline-block origin-bottom-left will-change-transform" variants={charV} custom={i++}>
                {w}
              </motion.span>
            ) : (
              [...w].map((ch, ci) => (
                <motion.span key={ci} className="inline-block origin-bottom-left will-change-transform" variants={charV} custom={i++}>
                  {ch}
                </motion.span>
              ))
            )}
            {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Fade + rise on enter. */
export function Reveal({ children, className, delay = 0, y = 28, as = "div" }: { children: ReactNode; className?: string; delay?: number; y?: number; as?: "div" | "li" | "p" | "section" }) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1, ease: EASE_OUT, delay }}
    >
      {children}
    </M>
  );
}

// ── Magnetic ─────────────────────────────────────────────────────────────────

/** Pulls its child toward the pointer when it is close; springs back on leave. */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 180, damping: 14, mass: 0.4 });
  const y = useSpring(0, { stiffness: 180, damping: 14, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      className={clsx("inline-block", className)}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Cursor ───────────────────────────────────────────────────────────────────

/**
 * Dot + ring follower. Elements opt in with data-cursor="view" | "drag" | "link" and an optional data-cursor-label.
 * Only on fine pointers, never with reduced motion.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<{ kind: string; label?: string; tint?: string }>({ kind: "default" });
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 320, damping: 32, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 320, damping: 32, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || reduce) return;
    setEnabled(true);
    document.documentElement.classList.add("has-cursor");
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor], a, button");
      const kind = el?.dataset.cursor ?? (el ? "link" : "default");
      setMode((m) => (m.kind === kind && m.label === el?.dataset.cursorLabel && m.tint === el?.dataset.cursorTint ? m : { kind, label: el?.dataset.cursorLabel, tint: el?.dataset.cursorTint }));
    };
    const leave = () => {
      x.set(-100);
      y.set(-100);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [reduce, x, y]);

  // A route change swaps the element under a resting pointer: drop any "View"/"Drag" state.
  const { pathname } = useLocation();
  useEffect(() => setMode({ kind: "default" }), [pathname]);

  if (!enabled) return null;
  const big = mode.kind === "view" || mode.kind === "drag";
  const size = big ? 96 : mode.kind === "link" ? 44 : 28;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70]">
      <motion.div className="absolute left-0 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone mix-blend-difference" style={{ x, y }} />
      <motion.div className="absolute left-0 top-0" style={{ x: rx, y: ry }}>
        <motion.div
          className="flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-medium uppercase tracking-[0.2em]"
          animate={{
            width: size,
            height: size,
            backgroundColor: big ? (mode.tint ?? "rgba(242,239,233,0.92)") : "rgba(242,239,233,0)",
            borderColor: big ? "rgba(242,239,233,0)" : "rgba(242,239,233,0.45)",
            color: big ? "#0b0b0c" : "rgba(0,0,0,0)",
          }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          {big && (
            <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} key={mode.label}>
              {mode.label ?? (mode.kind === "drag" ? "Drag" : "View")}
            </motion.span>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
