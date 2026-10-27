import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { Activity, ArrowRight, Boxes, Download, Layers, Package, Store, TriangleAlert } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../lib/useAsync";
import { LOW_STOCK, timeAgo } from "../lib/format";
import { CountUp } from "../components/CountUp";
import { JobKind, JobStatusBadge } from "../components/badges";
import { ProductImage } from "../components/ProductImage";
import { ColorPair, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { listItem, listParent } from "../components/motion";

function Stat({ label, icon, children, sub, tone }: { label: string; icon: ReactNode; children: ReactNode; sub?: ReactNode; tone?: "warn" | "danger" }) {
  return (
    <motion.div variants={listItem} className="flex flex-col gap-3 bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-muted">
        <span>{label}</span>
        <span className={clsx("text-subtle", tone === "warn" && "text-warn", tone === "danger" && "text-danger")}>{icon}</span>
      </div>
      <div className="text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{children}</div>
      {sub && <div className="text-[12.5px] text-subtle">{sub}</div>}
    </motion.div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const viewAll = (to: string, label = "View all") => (
  <Link to={to} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-fg">
    {label} <ArrowRight className="size-3.5" aria-hidden />
  </Link>
);

export function OverviewPage() {
  const stats = useAsync(api.stats);
  const jobs = useAsync(api.jobs);
  const products = useAsync(api.products);

  const lowStock = useMemo(() => {
    if (!products.data) return [];
    return products.data
      .filter((p) => p.status === "active")
      .flatMap((p) => p.variants.filter((v) => v.stock < LOW_STOCK).map((v) => ({ p, v })))
      .sort((a, b) => a.v.stock - b.v.stock || a.p.name.localeCompare(b.p.name));
  }, [products.data]);

  const s = stats.data;
  const icon = "size-4";

  return (
    <>
      <PageHeader
        title="Overview"
        description="Catalog health and syndication activity across every subscriber store."
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      />

      {stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.reload} />
      ) : !s ? (
        <div className="card grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 bg-surface p-5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div variants={listParent} initial="hidden" animate="show" className="card grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-3">
          <Stat label="Active products" icon={<Package className={icon} aria-hidden />} sub="Live in the catalog">
            <CountUp value={s.products} />
          </Stat>
          <Stat label="Variants" icon={<Layers className={icon} aria-hidden />} sub="Frame × lens combinations">
            <CountUp value={s.variants} />
          </Stat>
          <Stat label="Active stores" icon={<Store className={icon} aria-hidden />} sub={`Subscribed · ${s.totalStores} installed`}>
            <CountUp value={s.activeStores} />
            <span className="ml-1 text-[18px] font-medium text-subtle">/ {s.totalStores}</span>
          </Stat>
          <Stat label="Imported products" icon={<Download className={icon} aria-hidden />} sub="Product × store links">
            <CountUp value={s.importedProducts} />
          </Stat>
          <Stat label="Low-stock variants" icon={<TriangleAlert className={icon} aria-hidden />} tone={s.lowStockVariants ? "warn" : undefined} sub={`Under ${LOW_STOCK} units on hand`}>
            <span className={clsx(s.lowStockVariants > 0 && "text-warn")}>
              <CountUp value={s.lowStockVariants} />
            </span>
          </Stat>
          <Stat
            label="Sync jobs · 24h"
            icon={<Activity className={icon} aria-hidden />}
            tone={s.jobs24h.failed ? "danger" : undefined}
            sub={
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden /> {s.jobs24h.done} done
                </span>
                <span className={clsx("inline-flex items-center gap-1.5", s.jobs24h.failed > 0 && "font-medium text-danger")}>
                  <span className={clsx("size-1.5 rounded-full", s.jobs24h.failed ? "bg-danger" : "bg-subtle/50")} aria-hidden /> {s.jobs24h.failed} failed
                </span>
              </span>
            }
          >
            <CountUp value={s.jobs24h.done + s.jobs24h.failed} />
          </Stat>
        </motion.div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <SectionCard title="Recent sync jobs" action={viewAll("/jobs")}>
          {jobs.error ? (
            <div className="p-4">
              <ErrorState error={jobs.error} onRetry={jobs.reload} />
            </div>
          ) : !jobs.data ? (
            <ListSkeleton />
          ) : jobs.data.length === 0 ? (
            <EmptyState icon={<Activity className="size-4.5" aria-hidden />} title="No sync jobs yet">
              Jobs appear when a store imports a product or when stock and cost change.
            </EmptyState>
          ) : (
            <motion.ul variants={listParent} initial="hidden" animate="show" className="divide-y divide-line">
              {jobs.data.slice(0, 8).map((j) => (
                <motion.li key={j.id} variants={listItem} className="flex items-center gap-3 px-4 py-2.5">
                  <JobKind kind={j.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{j.productName ?? "Whole store"}</p>
                    <p className="truncate text-[12px] text-subtle">
                      {j.shop}
                      {j.error && <span className="text-danger"> · {j.error}</span>}
                    </p>
                  </div>
                  <time dateTime={j.createdAt} title={new Date(j.createdAt).toLocaleString()} className="hidden text-[12px] whitespace-nowrap text-subtle sm:block">
                    {timeAgo(j.createdAt)}
                  </time>
                  <JobStatusBadge status={j.status} />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </SectionCard>

        <SectionCard
          title="Low stock"
          action={lowStock.length ? <span className="text-[12px] text-subtle">{lowStock.length} variants under {LOW_STOCK}</span> : undefined}
        >
          {products.error ? (
            <div className="p-4">
              <ErrorState error={products.error} onRetry={products.reload} />
            </div>
          ) : !products.data ? (
            <ListSkeleton />
          ) : lowStock.length === 0 ? (
            <EmptyState icon={<Boxes className="size-4.5" aria-hidden />} title="Everything is well stocked">
              No active variant is under {LOW_STOCK} units.
            </EmptyState>
          ) : (
            <motion.ul variants={listParent} initial="hidden" animate="show" className="max-h-[476px] divide-y divide-line overflow-y-auto">
              {lowStock.slice(0, 12).map(({ p, v }) => (
                <motion.li key={v.id} variants={listItem}>
                  <Link to={`/products?q=${encodeURIComponent(p.name)}&open=${p.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
                    <ProductImage src={v.imageUrl ?? p.images[0]?.url} className="size-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{p.name}</p>
                      <p className="flex items-center gap-1.5 truncate text-[12px] text-subtle">
                        <ColorPair frame={v.frameColorHex} lens={v.lensColorHex} frameName={v.frameColor} lensName={v.lensColor} />
                        <span className="truncate">
                          {v.frameColor} / {v.lensColor}
                        </span>
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "min-w-10 rounded-md px-1.5 py-0.5 text-right text-[13px] font-semibold tabular-nums",
                        v.stock === 0 ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn",
                      )}
                    >
                      {v.stock}
                      <span className="sr-only"> units</span>
                    </span>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-5 w-12" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}
