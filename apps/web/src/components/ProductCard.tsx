import { useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { clsx } from "clsx";
import { formatMoney, label, marginPct, type Product } from "@lumen/core";
import { Picture } from "./Picture";

export function Swatch({ frame, lens, active, layoutGroup, onSelect, name }: { frame: string; lens: string; active: boolean; layoutGroup: string; onSelect: () => void; name: string }) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={active}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      className="relative grid h-7 w-7 place-items-center rounded-full"
    >
      {active && <motion.span layoutId={`ring-${layoutGroup}`} className="absolute inset-0 rounded-full border border-bone" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
      <span className="h-[18px] w-[18px] overflow-hidden rounded-full ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${frame} 0 50%, ${lens} 50% 100%)` }} />
    </button>
  );
}

/**
 * Catalog card: pointer tilt + moving highlight, glare sweep on hover, swatches swap the shot with a crossfade,
 * and the image is a shared element (View Transitions) into the product page.
 */
export function ProductCard({ product, size = "md", priority = false }: { product: Product; size?: "md" | "lg"; priority?: boolean }) {
  const reduce = useReducedMotion();
  const [vi, setVi] = useState(0);
  const v = product.variants[vi] ?? product.variants[0]!;
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, { stiffness: 220, damping: 20 });
  const ry = useSpring(0, { stiffness: 220, damping: 20 });
  const mx = useMotionValue(50);
  const my = useMotionValue(30);
  const highlight = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(255,255,255,0.55), transparent 45%)`;
  const href = `/p/${product.slug}?v=${v.id}`;
  const margin = marginPct(v.wholesaleCost, v.suggestedPrice);
  const stock = product.variants.reduce((n, x) => n + x.stock, 0);

  return (
    <motion.div className="h-full" style={{ perspective: 1000 }}>
      <motion.div style={reduce ? undefined : { rotateX: rx, rotateY: ry }} className="h-full will-change-transform">
        <div
          ref={ref}
          className="group flex h-full flex-col"
          onPointerMove={(e) => {
            if (reduce || e.pointerType !== "mouse") return;
            const b = ref.current!.getBoundingClientRect();
            const px = (e.clientX - b.left) / b.width;
            const py = (e.clientY - b.top) / b.height;
            ry.set((px - 0.5) * 10);
            rx.set((0.5 - py) * 8);
            mx.set(px * 100);
            my.set(py * 100);
          }}
          onPointerLeave={() => {
            rx.set(0);
            ry.set(0);
          }}
        >
          <Link
            to={href}
            viewTransition
            data-cursor="view"
            data-cursor-tint={v.lensColorHex}
            aria-label={`${product.name}, ${label(product.style)} sunglasses — wholesale ${formatMoney(v.wholesaleCost)}, suggested retail ${formatMoney(v.suggestedPrice)}`}
            className={clsx("glare relative block flex-1 overflow-hidden rounded-[24px] bg-bone-2", size === "lg" ? "min-h-[340px] sm:min-h-[520px]" : "min-h-[240px]")}
            style={{ viewTransitionName: `shot-${product.slug}` }}
          >
            <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 60%, ${v.lensColorHex}30, transparent 70%)` }} />
            <AnimatePresence initial={false}>
              <motion.div
                key={v.id}
                className="absolute inset-0 flex items-center justify-center p-[6%]"
                initial={{ opacity: 0, scale: 0.96, x: 12 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 1.02, x: -12 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <Picture
                  src={v.imageUrl}
                  alt={`${product.name} in ${v.frameColor} with ${v.lensColor} lenses`}
                  priority={priority}
                  sizes={size === "lg" ? "(min-width: 768px) 50vw, 92vw" : "(min-width: 1024px) 25vw, 46vw"}
                  imgClassName="h-auto w-full transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.05] drop-shadow-[0_24px_24px_rgba(40,30,20,0.25)]"
                />
              </motion.div>
            </AnimatePresence>
            <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-500 group-hover:opacity-100" style={{ background: highlight }} />
            <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
              {product.lensTypes.slice(0, 2).map((t) => (
                <span key={t} className="rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-bone backdrop-blur">
                  {label(t)}
                </span>
              ))}
            </div>
            {stock < 20 && <span className="absolute right-4 top-4 rounded-full bg-ember/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink">{stock === 0 ? "Restocking" : "Low stock"}</span>}
          </Link>
          <div className="flex items-start justify-between gap-3 px-1 pt-4">
            <div className="min-w-0">
              <h3 className={clsx("font-serif leading-none", size === "lg" ? "text-4xl" : "text-2xl")}>
                <Link to={href} viewTransition tabIndex={-1} className="link-underline">
                  {product.name}
                </Link>
              </h3>
              <p className="mt-1.5 truncate text-xs text-mute">
                {label(product.style)} · {label(product.frameMaterial)} · <span className="text-bone/80">{v.frameColor}</span> / {v.lensColor}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5" role="group" aria-label="Colourways">
              {product.variants.map((x, i) => (
                <Swatch key={x.id} name={`${x.frameColor} / ${x.lensColor}`} frame={x.frameColorHex} lens={x.lensColorHex} active={i === vi} layoutGroup={product.id} onSelect={() => setVi(i)} />
              ))}
            </div>
          </div>
          <dl className="mt-3 flex items-center gap-4 border-t hairline px-1 pt-3 text-xs">
            <div>
              <dt className="sr-only">Wholesale</dt>
              <dd className="tabular-nums text-bone">
                {formatMoney(v.wholesaleCost)} <span className="text-dim">wholesale</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Suggested retail</dt>
              <dd className="tabular-nums text-mute">{formatMoney(v.suggestedPrice)} retail</dd>
            </div>
            <div className="ml-auto">
              <dt className="sr-only">Margin</dt>
              <dd className="rounded-full border border-amber/40 px-2 py-0.5 tabular-nums text-amber">{margin}% margin</dd>
            </div>
          </dl>
        </div>
      </motion.div>
    </motion.div>
  );
}
