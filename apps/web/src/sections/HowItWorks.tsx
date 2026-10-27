import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from "motion/react";
import { formatMoney, type Product } from "@lumen/core";
import { Picture } from "../components/Picture";
import { EASE_OUT, Reveal, SplitText } from "../components/motion";

/** Loops 0..n-1 while visible — drives each little product demo. */
function useLoop(ref: React.RefObject<Element | null>, steps: number, ms: number) {
  const inView = useInView(ref, { margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(reduce ? steps - 1 : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setI((x) => (x + 1) % steps), ms);
    return () => clearInterval(id);
  }, [inView, reduce, steps, ms]);
  return i;
}

function Window({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border hairline bg-ink-2 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2 border-b hairline px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-bone/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-bone/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-bone/15" />
        <span className="ml-3 text-[11px] text-dim">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function InstallDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const s = useLoop(ref, 4, 1300);
  return (
    <div ref={ref}>
      <Window title="admin.shopify.com · Apps">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-amber/90 font-serif text-2xl italic text-ink">L</div>
          <div className="flex-1">
            <p className="text-sm font-medium">LUMEN Wholesale</p>
            <p className="text-xs text-dim">Sunglasses catalog · Auto stock sync</p>
          </div>
          <motion.div
            className="relative grid h-9 min-w-24 place-items-center overflow-hidden rounded-full px-4 text-xs font-semibold"
            animate={{ backgroundColor: s >= 2 ? "#4d6b52" : "#f2efe9", color: s >= 2 ? "#f2efe9" : "#0b0b0c", scale: s === 1 ? 0.94 : 1 }}
          >
            <AnimatePresence mode="wait">
              <motion.span key={s >= 2 ? "ok" : "go"} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
                {s >= 2 ? "Installed ✓" : "Install"}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>
        <motion.div className="mt-4 rounded-xl border hairline p-3 text-xs text-mute" animate={{ opacity: s >= 3 ? 1 : 0.35 }}>
          <div className="flex justify-between">
            <span>Monthly plan</span>
            <span className="text-bone">$49 / mo</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded bg-bone/10">
            <motion.div className="h-full bg-amber" animate={{ width: s >= 3 ? "100%" : "0%" }} transition={{ duration: 0.9, ease: EASE_OUT }} />
          </div>
        </motion.div>
      </Window>
    </div>
  );
}

function PickDemo({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useLoop(ref, 9, 650);
  const items = products.slice(0, 6);
  const picked = Math.min(s, 6);
  return (
    <div ref={ref}>
      <Window title="LUMEN · Catalog">
        <div className="grid grid-cols-3 gap-2">
          {items.map((p, i) => (
            <div key={p.id} className="relative rounded-lg bg-bone/[0.04] p-1.5">
              <Picture src={p.variants[0]?.imageUrl} alt="" sizes="120px" imgClassName="h-auto w-full" />
              <motion.span
                className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-ink"
                animate={{ scale: i < picked ? 1 : 0.6, backgroundColor: i < picked ? "#c8892b" : "rgba(242,239,233,0.15)" }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                {i < picked ? "✓" : ""}
              </motion.span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-bone/10">
            <motion.div className="h-full bg-bone" animate={{ width: s >= 7 ? "100%" : "0%" }} transition={{ duration: s >= 7 ? 0.9 : 0.2, ease: EASE_OUT }} />
          </div>
          <span className="w-28 text-right text-[11px] text-mute">{s >= 8 ? "6 imported ✓" : `Import ${picked}`}</span>
        </div>
      </Window>
    </div>
  );
}

function SyncDemo({ product }: { product: Product | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useLoop(ref, 6, 1100);
  const v = product?.variants[0];
  const stock = [42, 41, 39, 39, 64, 63][s]!;
  const cost = s >= 3 ? (v?.wholesaleCost ?? 2800) + 200 : (v?.wholesaleCost ?? 2800);
  return (
    <div ref={ref}>
      <Window title="your-store · Products">
        <div className="flex items-center gap-3">
          <div className="w-16 shrink-0 rounded-lg bg-bone/[0.04] p-1">
            <Picture src={v?.imageUrl} alt="" sizes="64px" imgClassName="h-auto w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product?.name ?? "Riviera"}</p>
            <p className="text-[11px] text-dim">Active · Online Store</p>
          </div>
          <motion.span key={s} className="rounded-full bg-g15/40 px-2 py-1 text-[10px] text-bone" initial={{ opacity: 0.3, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            ● Synced
          </motion.span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border hairline p-2.5">
            <dt className="text-dim">Stock</dt>
            <dd className="mt-1 text-base tabular-nums text-bone">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={stock} className="inline-block" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
                  {stock}
                </motion.span>
              </AnimatePresence>
            </dd>
          </div>
          <div className="rounded-lg border hairline p-2.5">
            <dt className="text-dim">Cost</dt>
            <dd className="mt-1 text-base tabular-nums text-bone">{formatMoney(cost)}</dd>
          </div>
          <div className="rounded-lg border border-amber/40 p-2.5">
            <dt className="flex items-center gap-1 text-dim">Your price 🔒</dt>
            <dd className="mt-1 text-base tabular-nums text-amber">{formatMoney(v?.suggestedPrice ?? 8900)}</dd>
          </div>
        </dl>
      </Window>
    </div>
  );
}

export function HowItWorks({ products }: { products: Product[] | null }) {
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 70%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const ps = products ?? [];

  const steps = [
    { n: "01", title: "Install the app", body: "One click from your Shopify admin. Approve permissions, start the monthly plan — no code, no theme edits.", demo: <InstallDemo /> },
    { n: "02", title: "Pick your frames", body: "Filter by style, frame colour, lens and gender. Select a few or select all, then import. Products land in Admin → Products with every colourway as a variant.", demo: <PickDemo products={ps} /> },
    { n: "03", title: "Sell. We keep it in sync.", body: "Stock and cost-per-item update automatically. Your price, titles, photos and descriptions are never overwritten — and we flag any frame whose cost catches up with your price.", demo: <SyncDemo product={ps[0]} /> },
  ];

  return (
    <section id="how" className="relative px-4 py-28 sm:px-8 md:py-40" aria-labelledby="how-title">
      <div className="mx-auto max-w-[1600px]">
        <p className="eyebrow">How it works for Shopify stores</p>
        <SplitText as="h2" by="word" text="Three steps. Zero spreadsheets." className="mt-4 block max-w-5xl font-serif text-mega" />
        <span id="how-title" className="sr-only">How it works</span>

        <ol ref={list} className="relative mt-20 grid gap-20 md:gap-32">
          <div aria-hidden className="absolute bottom-0 left-[11px] top-0 w-px bg-bone/10 md:left-1/2">
            <motion.div className="h-full w-full origin-top bg-amber" style={{ scaleY: line }} />
          </div>
          {steps.map((s, i) => (
            <li key={s.n} className="relative grid gap-8 pl-10 md:grid-cols-2 md:gap-24 md:pl-0">
              <span aria-hidden className="absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border border-amber bg-ink md:left-1/2 md:-translate-x-1/2">
                <span className="h-2 w-2 rounded-full bg-amber" />
              </span>
              <Reveal className={i % 2 ? "md:order-2 md:pl-8" : "md:pr-8 md:text-right"}>
                <p className="font-serif text-7xl italic text-bone/20 md:text-8xl">{s.n}</p>
                <h3 className="mt-2 font-serif text-4xl md:text-5xl">{s.title}</h3>
                <p className={`mt-4 max-w-md text-mute ${i % 2 ? "" : "md:ml-auto"}`}>{s.body}</p>
              </Reveal>
              <Reveal delay={0.15} className={i % 2 ? "md:order-1 md:pr-8" : "md:pl-8"}>
                <div className="mx-auto max-w-md">{s.demo}</div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
