import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { LENS_TYPES, filterProducts, label, type Collection, type LensType, type Product } from "@lumen/core";
import { ProductCard } from "../components/ProductCard";
import { Chips, PillGroup } from "../components/Filters";
import { COLLECTION_META, COLLECTION_ORDER } from "../lib/catalog";
import { EASE_OUT, SplitText } from "../components/motion";

type Tab = "all" | Collection;

/** Bento "live catalog" on the home page: real API data, filterable, with layout-animated reflow. */
export function CatalogPreview({ products }: { products: Product[] | null }) {
  const [tab, setTab] = useState<Tab>("all");
  const [lens, setLens] = useState<LensType[]>([]);
  const list = useMemo(
    () => filterProducts(products ?? [], { collection: tab === "all" ? undefined : [tab], lensType: lens.length ? lens : undefined }).slice(0, 7),
    [products, tab, lens],
  );
  const total = products?.length ?? 0;
  const variants = products?.reduce((n, p) => n + p.variants.length, 0) ?? 0;

  return (
    <section id="catalog" className="px-4 py-28 sm:px-8 md:py-40" aria-labelledby="catalog-title">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g15 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7fae86]" />
              </span>
              Live catalog
            </p>
            <SplitText as="h2" by="word" text="Wholesale prices, in the open." className="mt-4 block max-w-4xl font-serif text-mega" />
            <span id="catalog-title" className="sr-only">Live catalog preview</span>
          </div>
          <Link to="/catalog" viewTransition className="link-underline self-start text-sm md:self-auto" data-cursor="link">
            View all {total} frames →
          </Link>
        </div>

        <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PillGroup
            id="home-collection"
            label="Collection"
            value={tab}
            onChange={setTab}
            options={[{ value: "all", label: "All" }, ...COLLECTION_ORDER.map((c) => ({ value: c as Tab, label: COLLECTION_META[c].title, dot: COLLECTION_META[c].tint }))]}
          />
          <Chips label="Lens technology" options={LENS_TYPES.map((l) => ({ value: l, label: label(l) }))} values={lens} onToggle={(l) => setLens((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]))} />
        </div>

        <motion.ul layout className="mt-10 grid grid-flow-dense grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {!products &&
              Array.from({ length: 6 }, (_, i) => (
                <li key={`s${i}`} className={i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}>
                  <div className="h-full min-h-[300px] animate-pulse rounded-[24px] bg-ink-3" />
                </li>
              ))}
            {list.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
                transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.04 }}
                className={i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}
              >
                <ProductCard product={p} size={i === 0 ? "lg" : "md"} />
              </motion.li>
            ))}
            {products && (
              <motion.li key="stat" layout className="flex min-h-[260px] flex-col justify-between rounded-[24px] border hairline bg-ink-2 p-6">
                <p className="eyebrow">The line</p>
                <div>
                  <p className="font-serif text-6xl leading-none">{total}</p>
                  <p className="text-sm text-mute">frames · {variants} colourways</p>
                  <p className="mt-4 text-xs text-dim">Polarized, UV400, mirrored and gradient lenses. Metal, titanium, acetate and TR90 frames.</p>
                </div>
              </motion.li>
            )}
            {products && list.length === 0 && (
              <motion.li key="empty" layout className="col-span-full rounded-[24px] border border-dashed hairline p-12 text-center text-mute">
                No frames match that combination.{" "}
                <button className="link-underline text-bone" onClick={() => (setTab("all"), setLens([]))}>
                  Clear filters
                </button>
              </motion.li>
            )}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}
