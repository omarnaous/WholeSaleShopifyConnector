import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { GENDERS, LENS_TYPES, STYLES, filterProducts, filtersToSearch, label, parseFilters, type CatalogFilters, type Collection } from "@lumen/core";
import { useCatalog, COLLECTION_META, COLLECTION_ORDER } from "../lib/catalog";
import { ProductCard } from "../components/ProductCard";
import { Chips, PillGroup } from "../components/Filters";
import { EASE_OUT, SplitText } from "../components/motion";

type Tab = "all" | Collection;

export default function Catalog() {
  const products = useCatalog();
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [q, setQ] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Catalog — LUMEN Wholesale";
    window.scrollTo(0, 0);
  }, []);

  const update = (patch: Partial<CatalogFilters>) => setSp(new URLSearchParams(filtersToSearch({ ...filters, ...patch }).slice(1)), { replace: true, preventScrollReset: true });

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => (q !== (filters.q ?? "") ? update({ q: q || undefined }) : undefined), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const list = useMemo(() => filterProducts(products ?? [], filters), [products, filters]);
  const frameColors = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products ?? []) for (const v of p.variants) if (!m.has(v.frameColor)) m.set(v.frameColor, v.frameColorHex);
    return [...m].map(([value, swatch]) => ({ value, label: value, swatch }));
  }, [products]);
  const toggle = <K extends "style" | "lensType" | "gender" | "frameColor">(key: K, v: string) => {
    const cur = (filters[key] ?? []) as string[];
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<CatalogFilters>);
  };
  const tab: Tab = filters.collection?.length === 1 ? filters.collection[0]! : "all";
  const active = Object.values({ ...filters, collection: undefined }).filter((v) => (Array.isArray(v) ? v.length : v)).length;

  return (
    <div className="px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
      <div className="mx-auto max-w-[1600px]">
        <p className="eyebrow">Catalog · {products?.length ?? "—"} frames</p>
        <SplitText as="h1" text={tab === "all" ? "Every frame." : `${COLLECTION_META[tab].title}.`} key={tab} trigger className="mt-4 block font-serif text-display" />

        <div className="sticky top-16 z-20 -mx-4 mt-10 border-y hairline bg-ink/80 px-4 py-4 backdrop-blur-xl sm:top-20 sm:-mx-8 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <PillGroup
              id="catalog-collection"
              label="Collection"
              value={tab}
              onChange={(v) => update({ collection: v === "all" ? undefined : [v] })}
              options={[{ value: "all" as Tab, label: "All" }, ...COLLECTION_ORDER.map((c) => ({ value: c as Tab, label: COLLECTION_META[c].title, dot: COLLECTION_META[c].tint }))]}
            />
            <div className="flex items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border hairline px-4 py-2.5 focus-within:border-bone/40 lg:w-72 lg:flex-none">
                <span aria-hidden className="text-dim">⌕</span>
                <span className="sr-only">Search frames</span>
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, colour, SKU" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim" />
              </label>
              <label className="flex shrink-0 items-center gap-2 text-sm text-bone/80">
                <input type="checkbox" checked={!!filters.inStock} onChange={(e) => update({ inStock: e.target.checked || undefined })} className="accent-[var(--color-amber)]" />
                In stock
              </label>
            </div>
          </div>
          <details className="group mt-3 lg:open:mt-4" open={active > 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-mute [&::-webkit-details-marker]:hidden">
              <span className="transition-transform group-open:rotate-90">›</span> Refine {active > 0 && <span className="rounded-full bg-amber px-1.5 text-ink">{active}</span>}
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Chips label="Style" options={STYLES.map((s) => ({ value: s, label: label(s) }))} values={filters.style ?? []} onToggle={(v) => toggle("style", v)} />
              <Chips label="Lens" options={LENS_TYPES.map((s) => ({ value: s, label: label(s) }))} values={filters.lensType ?? []} onToggle={(v) => toggle("lensType", v)} />
              <Chips label="Gender" options={GENDERS.map((s) => ({ value: s, label: label(s) }))} values={filters.gender ?? []} onToggle={(v) => toggle("gender", v)} />
              <Chips label="Frame colour" options={frameColors} values={filters.frameColor ?? []} onToggle={(v) => toggle("frameColor", v)} />
            </div>
          </details>
        </div>

        <p className="mt-8 text-sm text-mute" aria-live="polite">
          {products ? `${list.length} ${list.length === 1 ? "frame" : "frames"}` : "Loading catalog…"}
        </p>
        <motion.ul layout className="mt-6 grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {!products && Array.from({ length: 8 }, (_, i) => <li key={`s${i}`} className="h-[380px] animate-pulse rounded-[24px] bg-ink-3" />)}
            {list.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: Math.min(i, 8) * 0.035 }}
              >
                <ProductCard product={p} priority={i < 3} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
        {products && list.length === 0 && (
          <div className="mt-6 rounded-[24px] border border-dashed hairline p-16 text-center">
            <p className="font-serif text-4xl">Nothing in that tint.</p>
            <p className="mt-2 text-mute">Try fewer filters.</p>
            <button
              className="mt-6 rounded-full bg-bone px-5 py-2.5 text-sm font-medium text-ink"
              onClick={() => {
                setQ("");
                setSp(new URLSearchParams(), { replace: true });
              }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
