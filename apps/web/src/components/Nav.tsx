import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { clsx } from "clsx";
import { EASE_OUT, useScrollTo } from "./motion";
import { InstallButton } from "./Install";

const LINKS = [
  { href: "#collections", label: "Collections" },
  { href: "#how", label: "How it works" },
  { href: "#catalog", label: "Catalog" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-sans text-[15px] font-semibold tracking-[0.32em]", className)}>
      <svg viewBox="0 0 40 16" className="h-3.5 w-auto" aria-hidden>
        <path d="M1 3.5C1 2 2.2 1 3.7 1h10c1.6 0 2.6 1 2.6 2.5v.6h7.4v-.6C23.7 2 24.7 1 26.3 1h10C37.8 1 39 2 39 3.5 39 10 35.5 15 30.6 15c-4 0-6.2-3.3-6.8-6.4h-7.6C15.6 11.7 13.4 15 9.4 15 4.5 15 1 10 1 3.5Z" fill="var(--color-amber)" />
      </svg>
      LUMEN
    </span>
  );
}

export function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const scrollTo = useScrollTo();
  const loc = useLocation();
  const navigate = useNavigate();
  const home = loc.pathname === "/";

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev && y > 400 && !menu);
    setSolid(y > 40);
  });
  useEffect(() => setMenu(false), [loc.pathname]);

  const go = (href: string) => {
    setMenu(false);
    if (home) scrollTo(href);
    else navigate(`/${href}`);
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden ? "-110%" : "0%" }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        <div className={clsx("mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 transition-colors duration-500 sm:h-20 sm:px-8", solid && "bg-ink/70 backdrop-blur-xl")}>
          <Link to="/" viewTransition aria-label="LUMEN home" className="relative z-10">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <button key={l.href} onClick={() => go(l.href)} className="link-underline text-sm text-bone/80 transition-colors hover:text-bone">
                {l.label}
              </button>
            ))}
            <Link to="/catalog" viewTransition className="link-underline text-sm text-bone/80 hover:text-bone">
              Full catalog
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <InstallButton />
            </div>
            <button
              className="relative z-10 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-full border hairline lg:hidden"
              aria-expanded={menu}
              aria-controls="mobile-menu"
              aria-label={menu ? "Close menu" : "Open menu"}
              onClick={() => setMenu((m) => !m)}
            >
              <motion.span className="block h-px w-5 bg-bone" animate={{ rotate: menu ? 45 : 0, y: menu ? 3.5 : 0 }} />
              <motion.span className="block h-px w-5 bg-bone" animate={{ rotate: menu ? -45 : 0, y: menu ? -3.5 : 0 }} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col justify-end bg-ink px-6 pb-10 pt-24 lg:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {[...LINKS, { href: "/catalog", label: "Full catalog" }].map((l, i) => (
                <motion.button
                  key={l.href}
                  onClick={() => (l.href.startsWith("/") ? navigate(l.href) : go(l.href))}
                  className="overflow-hidden text-left font-serif text-[13vw] leading-[1.02]"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.06, duration: 0.8, ease: EASE_OUT }}
                >
                  {l.label}
                </motion.button>
              ))}
            </nav>
            <motion.div className="mt-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <InstallButton size="lg" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
