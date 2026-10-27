import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { EASE_OUT, Magnetic } from "./motion";

const CLIENT_ID = (import.meta.env.VITE_SHOPIFY_CLIENT_ID as string | undefined) ?? "";

/** Shopify managed install: the store admin handles scopes + approval. */
export function installUrl(store: string) {
  const handle = store.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.myshopify\.com.*$/, "").replace(/\/.*$/, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(handle)}/oauth/install?client_id=${encodeURIComponent(CLIENT_ID)}`;
}

const Ctx = createContext<() => void>(() => undefined);
export const useInstall = () => useContext(Ctx);

export function InstallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      <InstallDialog open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}

function InstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [store, setStore] = useState("");
  const [going, setGoing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const valid = /^[a-z0-9][a-z0-9-]*(\.myshopify\.com)?$/i.test(store.trim().replace(/^https?:\/\//, ""));

  useEffect(() => {
    if (!open) return;
    setGoing(false);
    const t = setTimeout(() => input.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-lg overflow-hidden rounded-[28px] border hairline bg-ink-2 p-7 sm:p-10"
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber/25 blur-3xl" />
            <p className="eyebrow">Install on Shopify</p>
            <h2 id={titleId} className="mt-3 font-serif text-4xl leading-none sm:text-5xl">
              Where should we <span className="serif-italic text-amber">send</span> the frames?
            </h2>
            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                if (!valid) return;
                setGoing(true);
                window.location.href = installUrl(store);
              }}
            >
              <label htmlFor="store" className="eyebrow">
                Your store
              </label>
              <div className="mt-2 flex items-center rounded-full border hairline bg-ink px-5 focus-within:border-amber/60">
                <input
                  ref={input}
                  id="store"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="your-store"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-dim"
                />
                <span className="shrink-0 text-sm text-dim">.myshopify.com</span>
              </div>
              <button
                type="submit"
                disabled={!valid || going}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-bone py-4 text-sm font-semibold text-ink transition disabled:opacity-40"
              >
                {going ? <Spinner /> : <ShopifyMark className="h-4 w-4" />}
                {going ? "Opening Shopify…" : "Continue to Shopify"}
              </button>
              <p className="mt-4 text-center text-xs text-dim">You'll approve permissions in your Shopify admin. 7-day free trial, cancel anytime.</p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />;
}

/** Generic shopping-bag glyph (we don't redraw Shopify's trademarked logo). */
export function ShopifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </svg>
  );
}

/** Primary CTA used across the site. */
export function InstallButton({ size = "md", className, tone = "light" }: { size?: "md" | "lg" | "xl"; className?: string; tone?: "light" | "amber" }) {
  const open = useInstall();
  return (
    <Magnetic strength={0.3} className={className}>
      <button
        onClick={open}
        data-cursor="link"
        className={clsx(
          "group relative inline-flex items-center gap-3 overflow-hidden rounded-full font-semibold tracking-tight text-ink transition-transform duration-500 ease-[var(--ease-out-expo)] active:scale-[0.97]",
          tone === "light" ? "bg-bone" : "bg-amber",
          size === "md" && "px-5 py-3 text-sm",
          size === "lg" && "px-7 py-4 text-base",
          size === "xl" && "px-9 py-6 text-lg sm:px-12 sm:py-7 sm:text-xl",
        )}
      >
        {/* liquid fill on hover */}
        <span aria-hidden className={clsx("absolute inset-0 origin-bottom scale-y-0 rounded-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-y-100", tone === "light" ? "bg-amber" : "bg-bone")} />
        <ShopifyMark className="relative h-[1.1em] w-[1.1em]" />
        <span className="relative">Install on Shopify</span>
        <span aria-hidden className="relative inline-block transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1">
          →
        </span>
      </button>
    </Magnetic>
  );
}
