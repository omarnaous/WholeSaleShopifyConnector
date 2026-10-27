import { useMemo, useRef } from "react";
import { clsx } from "clsx";
import { Link } from "react-router";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { priceRange, formatMoney, type Collection, type Product } from "@lumen/core";
import { COLLECTION_META, COLLECTION_ORDER } from "../lib/catalog";
import { Picture } from "../components/Picture";
import { SplitText } from "../components/motion";

export function Marquee({ items, duration = 38 }: { items: string[]; duration?: number }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y hairline py-5" aria-hidden>
      <div className="marquee-track flex w-max gap-10 whitespace-nowrap" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-serif text-3xl italic text-bone/70 sm:text-5xl">
            {t}
            <span className="h-2 w-2 rounded-full bg-amber" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Pinned horizontal collection rail: vertical scroll drives the track sideways.
 * Reduced motion → plain native horizontal scroller with snap.
 */
export function Collections({ products }: { products: Product[] | null }) {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const x = useTransform(smooth, [0, 1], ["0%", "-75%"]);

  const byCollection = useMemo(() => {
    const m = new Map<Collection, Product[]>();
    for (const p of products ?? []) m.set(p.collection, [...(m.get(p.collection) ?? []), p]);
    return m;
  }, [products]);

  const panels = COLLECTION_ORDER.map((c) => ({ key: c, meta: COLLECTION_META[c], items: byCollection.get(c) ?? [] }));

  const header = (
    <div className="flex items-end justify-between gap-6 px-4 sm:px-8">
      <div>
        <p className="eyebrow">Collections</p>
        <SplitText as="h2" by="word" text="Four ways to wear the sun." className="mt-4 block max-w-4xl font-serif text-mega" />
      </div>
      <p className="hidden max-w-xs pb-3 text-sm text-mute md:block">Scroll to move through the line. Every frame ships with variants your customers can choose at checkout.</p>
    </div>
  );

  if (reduce) {
    return (
      <section id="collections" className="py-28">
        {header}
        <div className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:px-8">
          {panels.map((p, i) => (
            <Panel key={p.key} panel={p} index={i} progress={null} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="collections" ref={section} className="relative h-[400vh]" aria-label="Collections">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center gap-10 overflow-hidden pt-16">
        {header}
        <motion.div className="flex w-[400vw] gap-0 will-change-transform" style={{ x }} data-cursor="drag">
          {panels.map((p, i) => (
            <div key={p.key} className="w-screen shrink-0 px-4 sm:px-8">
              <Panel panel={p} index={i} progress={smooth} />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Panel({
  panel,
  index,
  progress,
}: {
  panel: { key: Collection; meta: (typeof COLLECTION_META)[Collection]; items: Product[] };
  index: number;
  progress: MotionValue<number> | null;
}) {
  const hero = panel.items[0];
  const others = panel.items.slice(1, 4);
  const center = index / 3;
  // Parallax: the product drifts against the track while its panel is centred.
  const still = useMotionValue(center);
  const imgX = useTransform(progress ?? still, [center - 0.33, center, center + 0.33], ["18%", "0%", "-18%"]);
  const rot = useTransform(progress ?? still, [center - 0.33, center + 0.33], [-8, 8]);
  const range = hero ? priceRange(hero) : null;
  return (
    <article
      className={clsx(
        "relative grid h-[68svh] min-h-[440px] shrink-0 snap-center overflow-hidden rounded-[32px] border hairline md:grid-cols-[1.1fr_1fr]",
        progress ? "w-full" : "w-[85vw] md:w-[70vw]",
      )}
      style={{ background: `radial-gradient(120% 90% at 75% 40%, ${panel.meta.tint}40 0%, ${panel.meta.tint}12 40%, #111112 75%)` }}
    >
      <div className="relative z-10 flex flex-col justify-between p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{panel.meta.index} / 04</span>
          <span className="eyebrow flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: panel.meta.tint }} />
            {panel.meta.tintName}
          </span>
        </div>
        <div>
          <h3 className="font-serif text-[clamp(3.6rem,10vw,10rem)] leading-[0.85] tracking-tight">{panel.meta.title}</h3>
          <p className="mt-4 max-w-sm text-mute">{panel.meta.line}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>{panel.items.length} frames</span>
            {range && (
              <span className="text-mute">
                from <span className="text-bone">{formatMoney(range.minCost)}</span> wholesale
              </span>
            )}
            <Link to={`/catalog?collection=${panel.key}`} viewTransition className="link-underline text-bone" data-cursor="view" data-cursor-label="Shop" data-cursor-tint={panel.meta.tint}>
              Explore {panel.meta.title} →
            </Link>
          </div>
        </div>
        <ul className="mt-6 hidden gap-3 md:flex">
          {others.map((p) => (
            <li key={p.id} className="w-28 rounded-2xl bg-bone/5 p-2">
              <Picture src={p.variants[0]?.imageUrl} alt="" sizes="112px" imgClassName="h-auto w-full" />
              <p className="mt-1 truncate text-center text-[11px] text-mute">{p.name}</p>
            </li>
          ))}
        </ul>
      </div>
      {hero && (
        <motion.div className="pointer-events-none absolute inset-x-4 top-[11%] md:relative md:inset-x-0 md:top-auto md:flex md:items-center" style={progress ? { x: imgX, rotate: rot } : undefined}>
          <Picture
            src={hero.variants[0]?.imageUrl}
            alt={`${hero.name} — ${panel.meta.title} collection`}
            sizes="(min-width: 768px) 45vw, 85vw"
            imgClassName="h-auto w-full drop-shadow-[0_40px_50px_rgba(0,0,0,0.55)]"
          />
        </motion.div>
      )}
    </article>
  );
}
