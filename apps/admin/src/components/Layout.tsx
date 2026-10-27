import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Activity, LayoutDashboard, LogOut, Menu, Package, Store, X } from "lucide-react";
import { BRAND } from "@lumen/core";
import { API_URL } from "../api";
import { useAuth } from "./Auth";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/stores", label: "Stores", icon: Store },
  { to: "/jobs", label: "Sync jobs", icon: Activity },
];

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-fg" />
        <path d="M5 13.5h22M7 13.5c0 4 1.6 6 4.3 6s4-2.2 4-5.2M25 13.5c0 4-1.6 6-4.3 6s-4-2.2-4-5.2" fill="none" stroke="#C8892B" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="text-[14px] font-semibold tracking-[0.18em] text-fg">{BRAND.name}</span>
    </span>
  );
}

function NavItems({ layoutGroup, onNavigate }: { layoutGroup: string; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
        return (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={clsx(
                "relative flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                active ? "text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`nav-active-${layoutGroup}`}
                  className="absolute inset-0 rounded-lg border border-line bg-surface shadow-card"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              )}
              {active && (
                <motion.span
                  layoutId={`nav-bar-${layoutGroup}`}
                  className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  aria-hidden
                />
              )}
              <Icon className={clsx("relative size-4", active ? "text-accent-ink" : "text-subtle")} strokeWidth={1.8} aria-hidden />
              <span className="relative">{label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarFooter() {
  const { signOut } = useAuth();
  let host = API_URL;
  try {
    host = new URL(API_URL).host;
  } catch {
    /* keep raw */
  }
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex items-center gap-2 px-2.5 text-[12px] text-subtle">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        <span className="truncate" title={API_URL}>
          API · {host}
        </span>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex h-8.5 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-2/70 hover:text-fg"
      >
        <LogOut className="size-4 text-subtle" strokeWidth={1.8} aria-hidden />
        Sign out
      </button>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:pl-[236px]">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[236px] flex-col border-r border-line bg-bg px-3 py-4 lg:flex">
        <div className="mb-6 flex items-center justify-between px-2.5">
          <Wordmark />
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-subtle uppercase">Wholesale</span>
        </div>
        <nav aria-label="Main">
          <NavItems layoutGroup="desktop" />
        </nav>
        <SidebarFooter />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-13 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mr-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[85vw] flex-col border-r border-line bg-bg px-3 py-4 shadow-pop lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="mb-6 flex items-center justify-between px-2.5">
                <Wordmark />
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Close navigation" autoFocus>
                  <X className="size-4.5" aria-hidden />
                </button>
              </div>
              <nav aria-label="Main">
                <NavItems layoutGroup="mobile" onNavigate={() => setOpen(false)} />
              </nav>
              <SidebarFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main id="main" className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        {children}
      </main>
    </div>
  );
}
