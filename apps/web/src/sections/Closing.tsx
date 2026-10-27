import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, animate, motion, useInView, useScroll, useTransform } from "motion/react";
import { PLAN, formatMoney, type Product } from "@lumen/core";
import { InstallButton } from "../components/Install";
import { Picture } from "../components/Picture";
import { EASE_OUT, Reveal, SplitText } from "../components/motion";
import { Logo } from "../components/Nav";

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.7,
      ease: EASE_OUT,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    prev.current = value;
    return () => c.stop();
  }, [value, format]);
  return <span ref={ref}>{format(value)}</span>;
}

const FEATURES = [
  "Full sunglasses catalog, new drops included",
  "One-click import with every colourway as variants",
  "Automatic stock and cost-per-item sync",
  "Margin alerts when cost catches up with your price",
  "Your prices, titles, photos — never overwritten",
  "Cancel anytime: products go to Draft, not deleted",
];

export function Pricing({ products }: { products: Product[] | null }) {
  const [pairs, setPairs] = useState(60);
  const sliderId = useId();
  const avg = useMemo(() => {
    const vs = (products ?? []).flatMap((p) => p.variants);
    if (!vs.length) return 5800;
    return Math.round(vs.reduce((n, v) => n + (v.suggestedPrice - v.wholesaleCost), 0) / vs.length);
  }, [products]);
  const gross = pairs * avg;
  const net = gross - PLAN.priceCents;
  const breakEven = Math.max(1, Math.ceil(PLAN.priceCents / avg));
  const money0 = (n: number) => formatMoney(Math.round(n / 100) * 100);

  return (
    <section id="pricing" className="px-4 py-28 sm:px-8 md:py-40" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-[1600px]">
        <p className="eyebrow">Pricing</p>
        <SplitText as="h2" by="word" text="One plan. Your margin." className="mt-4 block font-serif text-mega" />
        <span id="pricing-title" className="sr-only">Pricing</span>

        <div className="mt-16 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <Reveal className="relative overflow-hidden rounded-[32px] border hairline bg-ink-2 p-8 sm:p-12">
            <div aria-hidden className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-amber/20 blur-3xl" />
            <p className="eyebrow">Monthly</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-serif text-8xl leading-none sm:text-9xl">${PLAN.priceCents / 100}</span>
              <span className="text-mute">/ month</span>
            </p>
            <p className="mt-3 text-sm text-mute">{PLAN.trialDays}-day free trial · billed through Shopify · cancel anytime</p>
            <ul className="mt-10 grid gap-3">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f}
                  className="flex items-start gap-3 text-sm"
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.7, ease: EASE_OUT }}
                >
                  <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber/20 text-[9px] text-amber">✓</span>
                  {f}
                </motion.li>
              ))}
            </ul>
            <div className="mt-10">
              <InstallButton size="lg" />
            </div>
          </Reveal>

          <Reveal delay={0.1} className="flex flex-col justify-between rounded-[32px] border hairline p-8 sm:p-12">
            <div>
              <p className="eyebrow">Margin calculator</p>
              <label htmlFor={sliderId} className="mt-6 block font-serif text-4xl sm:text-5xl">
                If you sell <span className="serif-italic text-amber tabular-nums">{pairs}</span> pairs a month…
              </label>
              <input
                id={sliderId}
                type="range"
                min={5}
                max={400}
                step={5}
                value={pairs}
                onChange={(e) => setPairs(Number(e.target.value))}
                className="mt-8 w-full accent-[var(--color-amber)]"
                aria-valuetext={`${pairs} pairs per month`}
              />
              <div className="mt-2 flex justify-between text-xs text-dim">
                <span>5</span>
                <span>400</span>
              </div>
            </div>
            <dl className="mt-10 grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="eyebrow">Avg. margin / pair</dt>
                <dd className="mt-2 font-serif text-4xl">{formatMoney(avg)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Gross profit</dt>
                <dd className="mt-2 font-serif text-4xl tabular-nums">
                  <AnimatedNumber value={gross} format={money0} />
                </dd>
              </div>
              <div>
                <dt className="eyebrow">After the plan</dt>
                <dd className="mt-2 font-serif text-4xl tabular-nums text-amber">
                  <AnimatedNumber value={net} format={money0} />
                </dd>
              </div>
            </dl>
            <p className="mt-8 text-xs text-dim">
              At suggested retail prices. The plan pays for itself after {breakEven} {breakEven === 1 ? "pair" : "pairs"}. You set your own prices — this is an estimate, not a promise.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const QA = [
  { q: "Do I control my selling prices?", a: "Yes. On import we set each variant to the suggested retail price — after that, your price is yours. We never overwrite price, title, description or images. Only stock and cost-per-item stay in sync." },
  { q: "What exactly syncs, and how often?", a: "Stock levels and wholesale cost (Shopify's “Cost per item”). When the wholesaler changes either, every store that imported that frame is updated within minutes." },
  { q: "What is a margin alert?", a: "If the wholesale cost of a frame rises to or above the price you sell it for, the app flags it so you can reprice before you sell at a loss." },
  { q: "What happens if I cancel?", a: "Every imported product is set to Draft — hidden from your storefront, nothing deleted. Re-subscribe and they go straight back to Active." },
  { q: "Do I need to code or edit my theme?", a: "No. Everything happens inside the app in your Shopify admin. Imported frames are regular Shopify products and work with any theme and checkout." },
  { q: "Which platforms do you support?", a: "Shopify only, by design. One platform done properly." },
  { q: "How are orders fulfilled?", a: "Fulfilment terms are agreed with the wholesaler when you join. Contact us before installing if you need details for your market." },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-4 py-28 sm:px-8 md:py-40" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-[1600px] gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">FAQ</p>
          <SplitText as="h2" by="word" text="Questions, answered." className="mt-4 block font-serif text-mega" />
          <span id="faq-title" className="sr-only">Frequently asked questions</span>
        </div>
        <ul className="border-t hairline">
          {QA.map((item, i) => {
            const isOpen = open === i;
            const id = `faq-${i}`;
            return (
              <li key={item.q} className="border-b hairline">
                <h3>
                  <button
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="font-serif text-2xl transition-colors group-hover:text-amber sm:text-3xl">{item.q}</span>
                    <motion.span aria-hidden animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.5, ease: EASE_OUT }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border hairline text-lg">
                      +
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={id}
                      key="a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-7 pr-12 text-mute">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function FinalCTA({ products }: { products: Product[] | null }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["25%", "0%"]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-14, 0]);
  const inView = useInView(ref, { margin: "-20%" });
  const hero = products?.find((p) => p.slug === "altitude") ?? products?.[0];
  return (
    <section ref={ref} className="relative overflow-hidden px-4 pb-16 pt-36 sm:px-8" aria-labelledby="cta-title">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 70%, rgba(200,137,43,0.28), transparent 70%)" }} />
      <div className="relative mx-auto flex max-w-[1600px] flex-col items-center text-center">
        <p className="eyebrow">Ready when you are</p>
        <h2 id="cta-title" className="mt-6 font-serif text-display">
          <SplitText text="Your store." className="block" />
          <SplitText text="Our frames." delay={0.2} className="block italic text-amber" />
        </h2>
        <motion.div className="pointer-events-none -my-[6%] w-[min(900px,92vw)]" style={{ y, rotate }} aria-hidden>
          {hero && <Picture src={hero.variants[0]?.imageUrl} alt="" sizes="900px" imgClassName="h-auto w-full drop-shadow-[0_50px_60px_rgba(0,0,0,0.6)]" />}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4, duration: 0.9, ease: EASE_OUT }} className="relative z-10 flex flex-col items-center gap-5">
          <InstallButton size="xl" tone="amber" />
          <p className="text-sm text-mute">Installs in under a minute · {PLAN.trialDays}-day free trial</p>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t hairline px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-mute">
          <Link to="/catalog" viewTransition className="link-underline hover:text-bone">
            Catalog
          </Link>
          <a href="/#pricing" className="link-underline hover:text-bone">
            Pricing
          </a>
          <a href="/#faq" className="link-underline hover:text-bone">
            FAQ
          </a>
          <a href="mailto:wholesale@lumen.example" className="link-underline hover:text-bone">
            Contact
          </a>
        </nav>
        <p className="text-xs text-dim">© {new Date().getFullYear()} LUMEN Eyewear Wholesale. Built for Shopify.</p>
      </div>
    </footer>
  );
}
