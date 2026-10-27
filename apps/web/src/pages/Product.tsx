import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { formatMoney, label, marginPct } from "@lumen/core";
import { COLLECTION_META, useCatalog } from "../lib/catalog";
import { Picture } from "../components/Picture";
import { ProductCard, Swatch } from "../components/ProductCard";
import { InstallButton } from "../components/Install";
import { EASE_OUT, Reveal, SplitText } from "../components/motion";

export default function ProductPage() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const products = useCatalog();
  const product = products?.find((p) => p.slug === slug);
  const [vid, setVid] = useState(sp.get("v"));
  const v = product?.variants.find((x) => x.id === vid) ?? product?.variants[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  useEffect(() => {
    if (product) document.title = `${product.name} — LUMEN Wholesale`;
  }, [product]);

  const related = useMemo(() => (products ?? []).filter((p) => p.collection === product?.collection && p.id !== product?.id).slice(0, 3), [products, product]);

  if (products && !product)
    return (
      <div className="grid min-h-[80svh] place-items-center px-4 text-center">
        <div>
          <p className="font-serif text-6xl">Frame not found.</p>
          <Link to="/catalog" viewTransition className="link-underline mt-6 inline-block text-mute">
            Back to the catalog
          </Link>
        </div>
      </div>
    );
  if (!product || !v) return <div className="min-h-[100svh]" />;

  const meta = COLLECTION_META[product.collection];
  const select = (id: string) => {
    setVid(id);
    setSp({ v: id }, { replace: true, preventScrollReset: true });
  };

  return (
    <article className="px-4 pb-24 pt-24 sm:px-8 sm:pt-28">
      <div className="mx-auto max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="eyebrow flex gap-2">
          <Link to="/catalog" viewTransition className="link-underline hover:text-bone">
            Catalog
          </Link>
          <span>/</span>
          <Link to={`/catalog?collection=${product.collection}`} viewTransition className="link-underline hover:text-bone">
            {meta.title}
          </Link>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div className="glare relative aspect-[4/3] overflow-hidden rounded-[32px] bg-bone-2 lg:sticky lg:top-24 lg:self-start" style={{ viewTransitionName: `shot-${product.slug}` }}>
            <motion.div aria-hidden className="absolute inset-0" animate={{ background: `radial-gradient(60% 55% at 50% 62%, ${v.lensColorHex}40, transparent 70%)` }} transition={{ duration: 0.8 }} />
            <AnimatePresence initial={false}>
              <motion.div
                key={v.id}
                className="absolute inset-0 flex items-center justify-center p-[5%]"
                initial={{ opacity: 0, x: 30, rotate: 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -30, rotate: -2 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
              >
                <Picture src={v.imageUrl} alt={`${product.name} in ${v.frameColor} with ${v.lensColor} lenses`} priority sizes="(min-width: 1024px) 58vw, 92vw" imgClassName="h-auto w-full drop-shadow-[0_30px_30px_rgba(40,30,20,0.28)]" />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.tint }} /> {meta.title} collection
            </p>
            <SplitText as="h1" text={product.name} trigger className="mt-4 block font-serif text-[clamp(4rem,9vw,9rem)] leading-[0.85]" />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-mute">{product.description}</p>

            <div className="mt-10">
              <p className="eyebrow">
                Colourway · <span className="text-bone">{v.frameColor} / {v.lensColor}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Colourways">
                {product.variants.map((x) => (
                  <Swatch key={x.id} name={`${x.frameColor} / ${x.lensColor}`} frame={x.frameColorHex} lens={x.lensColorHex} active={x.id === v.id} layoutGroup={`pdp-${product.id}`} onSelect={() => select(x.id)} />
                ))}
              </div>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border hairline bg-[var(--color-line)]">
              {[
                ["Wholesale", formatMoney(v.wholesaleCost)],
                ["Suggested retail", formatMoney(v.suggestedPrice)],
                ["Your margin", `${marginPct(v.wholesaleCost, v.suggestedPrice)}%`],
              ].map(([k, val], i) => (
                <div key={k} className="bg-ink p-5">
                  <dt className="eyebrow">{k}</dt>
                  <dd className={`mt-2 font-serif text-3xl tabular-nums sm:text-4xl ${i === 2 ? "text-amber" : ""}`}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={`${v.id}-${k}`} className="inline-block" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}>
                        {val}
                      </motion.span>
                    </AnimatePresence>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-dim">You set the selling price in your store. Suggested retail is applied once on import.</p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <InstallButton size="lg" />
              <span className={`text-sm ${v.stock > 0 ? "text-mute" : "text-ember"}`}>
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${v.stock > 20 ? "bg-[#7fae86]" : v.stock > 0 ? "bg-amber" : "bg-ember"}`} />
                {v.stock > 0 ? `${v.stock} in stock` : "Restocking"}
              </span>
            </div>

            <Reveal className="mt-14">
              <h2 className="eyebrow">Specifications</h2>
              <dl className="mt-4 divide-y divide-[var(--color-line)] border-y hairline text-sm">
                {[
                  ["Style", label(product.style)],
                  ["Frame", label(product.frameMaterial)],
                  ["Lens", product.lensTypes.map(label).join(" · ")],
                  ["Fit", label(product.gender)],
                  ["Lens width", v.size === "One" ? "One size" : `${v.size} mm`],
                  ["SKU", v.sku],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-6 py-3.5">
                    <dt className="text-mute">{k}</dt>
                    <dd className="text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-32" aria-labelledby="related-title">
            <h2 id="related-title" className="font-serif text-5xl">
              More <span className="serif-italic text-amber">{meta.title.toLowerCase()}</span>
            </h2>
            <ul className="mt-10 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
