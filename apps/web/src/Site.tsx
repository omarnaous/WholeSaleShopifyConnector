import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from "motion/react";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/inter-tight";
import { Cursor, EASE_IN_OUT, EASE_OUT, SmoothScroll, useLenis } from "./components/motion";
import { InstallProvider } from "./components/Install";
import { Nav } from "./components/Nav";
import { Footer } from "./sections/Closing";
import Home from "./pages/Home";
import { loadCatalog } from "./lib/catalog";

const Catalog = lazy(() => import("./pages/Catalog"));
const ProductPage = lazy(() => import("./pages/Product"));

/** First-visit curtain: wordmark + counter while fonts and the catalog warm up (≈1.2s, skipped on repeat / reduced motion). */
function Preloader({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, 100, { duration: 1.25, ease: [0.65, 0, 0.35, 1], onUpdate: (v) => setN(Math.round(v)) });
    Promise.all([c.finished, document.fonts?.ready, loadCatalog()]).then(() => setTimeout(onDone, 150));
    return () => c.stop();
  }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-between bg-ink px-4 pb-6 sm:px-8 sm:pb-8"
      exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.9, ease: EASE_IN_OUT } }}
      initial={{ clipPath: "inset(0 0 0% 0)" }}
      aria-hidden
    >
      <div className="overflow-hidden">
        <motion.p className="font-serif text-[22vw] leading-[0.8] tracking-tight sm:text-[16vw]" initial={{ y: "100%" }} animate={{ y: "0%" }} transition={{ duration: 1, ease: EASE_OUT }}>
          Lumen<span className="text-amber">.</span>
        </motion.p>
      </div>
      <p className="pb-3 font-serif text-5xl tabular-nums text-bone/60">{n}</p>
    </motion.div>
  );
}

function ScrollReset() {
  const { pathname } = useLocation();
  const lenis = useLenis();
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname, lenis]);
  return null;
}

function NotFound() {
  return (
    <div className="grid min-h-[80svh] place-items-center px-4 text-center">
      <div>
        <p className="font-serif text-8xl">404</p>
        <p className="mt-2 text-mute">This page went out of stock.</p>
      </div>
    </div>
  );
}

export default function Site() {
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(() => {
    try {
      return !reduce && !sessionStorage.getItem("lumen:seen") && location.pathname === "/";
    } catch {
      return false;
    }
  });
  const done = () => {
    try {
      sessionStorage.setItem("lumen:seen", "1");
    } catch {
      /* private mode */
    }
    setLoading(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll>
        <InstallProvider>
          <div className="grain">
            <ScrollReset />
            <Nav />
            <main id="main">
              <Suspense fallback={<div className="min-h-[100svh]" />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/catalog" element={<Catalog />} />
                  <Route path="/p/:slug" element={<ProductPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <Cursor />
          </div>
          <AnimatePresence>{loading && <Preloader key="pre" onDone={done} />}</AnimatePresence>
        </InstallProvider>
      </SmoothScroll>
    </MotionConfig>
  );
}
