import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Archive, ArchiveRestore, ChevronRight, Glasses, Pencil, Plus, Search, X } from "lucide-react";
import { COLLECTIONS, label, marginPct, type Product, type Variant } from "@lumen/core";
import { api } from "../api";
import { useAsync } from "../lib/useAsync";
import { centsToDollars, dollarsToCents, LOW_STOCK, money2, moneyRange, plural, syncedMsg } from "../lib/format";
import { coverImage, productSummary, productToInput } from "../lib/product";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { ProductImage } from "../components/ProductImage";
import { ProductStatusBadge } from "../components/badges";
import { Segmented } from "../components/Segmented";
import { Button, ColorPair, EmptyState, ErrorState, IconButton, PageHeader, Skeleton } from "../components/ui";
import { listItem, listParent } from "../components/motion";

type StatusFilter = "all" | "active" | "archived";
interface Draft {
  stock: string;
  cost: string;
}
type Drafts = Record<string, Draft>;

const draftFor = (v: Variant, d?: Draft): Draft => d ?? { stock: String(v.stock), cost: centsToDollars(v.wholesaleCost) };

/** Parsed draft, or null when invalid. */
function parseDraft(d: Draft) {
  const stock = /^\d+$/.test(d.stock.trim()) ? Number.parseInt(d.stock, 10) : null;
  const cost = dollarsToCents(d.cost);
  return { stock, cost };
}

function isDirty(v: Variant, d?: Draft) {
  if (!d) return false;
  const { stock, cost } = parseDraft(d);
  return stock !== v.stock || cost !== v.wholesaleCost;
}

export function ProductsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const collection = params.get("collection") ?? "";
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const openId = params.get("open");

  const products = useAsync(api.products);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [importedBy, setImportedBy] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const setParam = (k: string, v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true },
    );

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch import count for the expanded product (list endpoint doesn't include it).
  useEffect(() => {
    if (!openId || importedBy[openId] !== undefined) return;
    api
      .product(openId)
      .then((p) => setImportedBy((m) => ({ ...m, [openId]: p.importedBy ?? 0 })))
      .catch(() => {});
  }, [openId, importedBy]);

  const all = products.data ?? [];
  const filtered = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (collection ? p.collection === collection : true))
      .filter((p) => {
        if (!terms.length) return true;
        const hay = [p.name, p.slug, p.collection, p.style, p.frameMaterial, ...p.variants.flatMap((v) => [v.sku, v.frameColor, v.lensColor])].join(" ").toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
  }, [all, q, collection, status]);

  const counts = useMemo(
    () => ({ all: all.length, active: all.filter((p) => p.status === "active").length, archived: all.filter((p) => p.status === "archived").length }),
    [all],
  );

  const toggle = (id: string) => setParam("open", openId === id ? null : id);

  const setDraft = (v: Variant, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [v.id]: { ...draftFor(v, d[v.id]), ...patch } }));
  const discard = (p: Product) =>
    setDrafts((d) => {
      const next = { ...d };
      for (const v of p.variants) delete next[v.id];
      return next;
    });

  async function saveVariants(p: Product, only?: Variant) {
    const targets = (only ? [only] : p.variants).filter((v) => isDirty(v, drafts[v.id]));
    if (!targets.length) return;
    for (const v of targets) {
      const { stock, cost } = parseDraft(drafts[v.id]!);
      if (stock === null || cost === null) {
        toast.error("Fix invalid values first", `${v.sku}: stock must be a whole number and cost a dollar amount`);
        return;
      }
    }
    setSaving((s) => new Set([...s, ...targets.map((v) => v.id)]));
    let stores = 0;
    const saved: Record<string, { stock: number; wholesaleCost: number }> = {};
    try {
      for (const v of targets) {
        const { stock, cost } = parseDraft(drafts[v.id]!);
        const patch: { stock?: number; wholesaleCost?: number } = {};
        if (stock !== v.stock) patch.stock = stock!;
        if (cost !== v.wholesaleCost) patch.wholesaleCost = cost!;
        const res = await api.patchVariant(v.id, patch);
        // One sync job per importing store per call: the max is the store count.
        stores = Math.max(stores, res.syncJobsQueued);
        saved[v.id] = { stock: stock!, wholesaleCost: cost! };
      }
      toast.success(`Saved · ${syncedMsg(stores)}`, targets.length > 1 ? `${targets.length} variants of ${p.name} updated` : `${targets[0]!.sku} updated`);
    } catch (e) {
      toast.error("Couldn't save variant", (e as Error).message);
    } finally {
      const ids = Object.keys(saved);
      products.setData((list) =>
        list ? list.map((x) => (x.id !== p.id ? x : { ...x, variants: x.variants.map((v) => (saved[v.id] ? { ...v, ...saved[v.id] } : v)) })) : list,
      );
      setDrafts((d) => {
        const next = { ...d };
        for (const id of ids) delete next[id];
        return next;
      });
      setSaving((s) => new Set([...s].filter((id) => !targets.some((v) => v.id === id))));
    }
  }

  async function archive(p: Product) {
    const ok = await confirm({
      title: `Archive ${p.name}?`,
      body: (
        <>
          It disappears from the catalog for new imports. Stores that already imported it keep their copy and mapping. You can restore it later.
        </>
      ),
      confirmLabel: "Archive product",
    });
    if (!ok) return;
    try {
      await api.archiveProduct(p.id);
      products.setData((list) => list?.map((x) => (x.id === p.id ? { ...x, status: "archived" } : x)) ?? list);
      toast.success(`${p.name} archived`);
    } catch (e) {
      toast.error("Couldn't archive", (e as Error).message);
    }
  }

  async function restore(p: Product) {
    try {
      const { product } = await api.updateProduct(p.id, productToInput(p, { status: "active" }));
      products.setData((list) => list?.map((x) => (x.id === p.id ? product : x)) ?? list);
      toast.success(`${p.name} restored`);
    } catch (e) {
      toast.error("Couldn't restore", (e as Error).message);
    }
  }

  const rowProps = { drafts, saving, importedBy, setDraft, discard, saveVariants, archive, restore, toggle };
  const hasFilters = !!(q || collection || status !== "all");

  return (
    <>
      <PageHeader
        title="Products"
        description={
          products.data ? (
            <>
              {plural(counts.active, "active product")} · {plural(all.reduce((n, p) => n + p.variants.length, 0), "variant")}. Stock and cost edits sync to stores instantly.
            </>
          ) : (
            "Your wholesale catalog."
          )
        }
        actions={
          <Link
            to="/products/new"
            className="inline-flex h-8.5 items-center gap-2 rounded-lg bg-fg px-3.5 text-[13.5px] font-medium text-bg shadow-card transition-colors hover:bg-fg/88"
          >
            <Plus className="size-4" aria-hidden /> New product
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="relative md:w-[300px]">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            ref={searchRef}
            id="product-search"
            type="search"
            placeholder="Search name, SKU, color…"
            value={q}
            onChange={(e) => setParam("q", e.target.value || null)}
            className="field pr-8 pl-8.5"
          />
          {!q && <span className="kbd pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 md:inline">/</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="collection-filter" className="sr-only">
            Collection
          </label>
          <select id="collection-filter" value={collection} onChange={(e) => setParam("collection", e.target.value || null)} className="field w-auto min-w-[160px]">
            <option value="">All collections</option>
            {COLLECTIONS.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          <Segmented
            id="product-status"
            label="Status"
            value={status}
            onChange={(v) => setParam("status", v === "all" ? null : v)}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "active", label: "Active", count: counts.active },
              { value: "archived", label: "Archived", count: counts.archived },
            ]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<X className="size-3.5" aria-hidden />} onClick={() => setParams({}, { replace: true })}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {products.error ? (
        <ErrorState error={products.error} onRetry={products.reload} />
      ) : !products.data ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Glasses className="size-5" aria-hidden />}
            title={hasFilters ? "No products match" : "No products yet"}
            action={
              hasFilters ? (
                <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
              ) : (
                <Link to="/products/new" className="text-[13.5px] font-medium text-accent-ink hover:underline">
                  Create your first product
                </Link>
              )
            }
          >
            {hasFilters ? "Try a different search or clear the filters." : "Add a frame to start syndicating it to subscriber stores."}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-[13.5px]">
                <caption className="sr-only">Products. Expand a row to edit variant stock and wholesale cost.</caption>
                <thead>
                  <tr>
                    <th className="th w-9 pr-0" scope="col">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="th" scope="col">
                      Product
                    </th>
                    <th className="th hidden lg:table-cell" scope="col">
                      Collection
                    </th>
                    <th className="th hidden xl:table-cell" scope="col">
                      Lenses
                    </th>
                    <th className="th text-right" scope="col">
                      Variants
                    </th>
                    <th className="th text-right" scope="col">
                      Stock
                    </th>
                    <th className="th text-right" scope="col">
                      Cost
                    </th>
                    <th className="th text-right" scope="col">
                      Suggested
                    </th>
                    <th className="th" scope="col">
                      Status
                    </th>
                    <th className="th" scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <motion.tbody variants={listParent} initial="hidden" animate="show">
                  {filtered.map((p) => (
                    <ProductRow key={p.id} p={p} open={openId === p.id} {...rowProps} />
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <motion.ul variants={listParent} initial="hidden" animate="show" className="flex flex-col gap-3 md:hidden">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} open={openId === p.id} {...rowProps} />
            ))}
          </motion.ul>
          <p className="mt-3 text-[12.5px] text-subtle">
            Showing {filtered.length} of {plural(all.length, "product")}
          </p>
        </>
      )}
    </>
  );
}

interface RowProps {
  p: Product;
  open: boolean;
  drafts: Drafts;
  saving: Set<string>;
  importedBy: Record<string, number>;
  setDraft: (v: Variant, patch: Partial<Draft>) => void;
  discard: (p: Product) => void;
  saveVariants: (p: Product, only?: Variant) => Promise<void>;
  archive: (p: Product) => void;
  restore: (p: Product) => void;
  toggle: (id: string) => void;
}

function StockCell({ n, lowCount }: { n: number; lowCount: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {lowCount > 0 && (
        <span className="size-1.5 rounded-full bg-warn" title={`${lowCount} low-stock variants`} aria-label={`${lowCount} low-stock variants`} role="img" />
      )}
      {n.toLocaleString("en-US")}
    </span>
  );
}

function ProductRow({ p, open, toggle, archive, restore, ...rest }: RowProps) {
  const s = productSummary(p);
  const low = p.variants.filter((v) => v.stock < LOW_STOCK).length;
  const panelId = `variants-${p.id}`;
  const dirtyCount = p.variants.filter((v) => isDirty(v, rest.drafts[v.id])).length;
  return (
    <Fragment>
      <motion.tr variants={listItem} className={clsx("group transition-colors", open ? "bg-surface-2/50" : "hover:bg-surface-2/40", p.status === "archived" && "text-muted")}>
        <td className="td w-9 pr-0">
          <IconButton label={open ? `Collapse ${p.name}` : `Edit variants of ${p.name}`} aria-expanded={open} aria-controls={panelId} onClick={() => toggle(p.id)}>
            <ChevronRight className={clsx("size-4 transition-transform duration-200", open && "rotate-90")} aria-hidden />
          </IconButton>
        </td>
        <td className="td">
          <div className="flex items-center gap-3">
            <ProductImage src={coverImage(p)} alt="" className={clsx("size-10 shrink-0", p.status === "archived" && "opacity-60")} />
            <div className="min-w-0">
              <Link to={`/products/${p.id}`} className="font-medium text-fg hover:underline hover:underline-offset-4">
                {p.name}
              </Link>
              <div className="flex items-center gap-1.5 text-[12px] text-subtle">
                <span>{label(p.style)}</span>
                <span aria-hidden>·</span>
                <span>{label(p.frameMaterial)}</span>
                {dirtyCount > 0 && <span className="ml-1 rounded bg-accent-soft px-1 text-[11px] font-medium text-accent-ink">{dirtyCount} unsaved</span>}
              </div>
            </div>
          </div>
        </td>
        <td className="td hidden lg:table-cell">
          <span className="text-fg">{label(p.collection)}</span>
          <span className="block text-[12px] text-subtle">{label(p.gender)}</span>
        </td>
        <td className="td hidden xl:table-cell">
          <div className="flex max-w-[200px] flex-wrap gap-1">
            {p.lensTypes.map((l) => (
              <span key={l} className="rounded-md border border-line bg-surface px-1.5 py-[1px] text-[11.5px] text-muted">
                {label(l)}
              </span>
            ))}
          </div>
        </td>
        <td className="td text-right tabular-nums">
          <span className="inline-flex items-center justify-end gap-2">
            <span className="hidden -space-x-1 lg:inline-flex" aria-hidden>
              {p.variants.slice(0, 4).map((v) => (
                <span key={v.id} className="size-3 rounded-full ring-2 ring-surface" style={{ background: v.lensColorHex }} />
              ))}
            </span>
            {p.variants.length}
          </span>
        </td>
        <td className="td text-right tabular-nums">
          <StockCell n={s.totalStock} lowCount={low} />
        </td>
        <td className="td text-right whitespace-nowrap tabular-nums">{moneyRange(s.minCost, s.maxCost)}</td>
        <td className="td text-right whitespace-nowrap tabular-nums">{moneyRange(s.minPrice, s.maxPrice)}</td>
        <td className="td">
          <ProductStatusBadge status={p.status} />
        </td>
        <td className="td pl-0 text-right whitespace-nowrap">
          <div className="inline-flex items-center gap-0.5">
            <Link
              to={`/products/${p.id}`}
              aria-label={`Edit ${p.name}`}
              title="Edit product"
              className="inline-flex size-7.5 items-center justify-center rounded-[7px] text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Pencil className="size-3.5" aria-hidden />
            </Link>
            {p.status === "active" ? (
              <IconButton label={`Archive ${p.name}`} onClick={() => archive(p)}>
                <Archive className="size-3.5" aria-hidden />
              </IconButton>
            ) : (
              <IconButton label={`Restore ${p.name}`} onClick={() => restore(p)}>
                <ArchiveRestore className="size-3.5" aria-hidden />
              </IconButton>
            )}
          </div>
        </td>
      </motion.tr>
      {open && (
        <tr id={panelId}>
          <td colSpan={10} className="border-b border-line bg-surface-2/50 p-0">
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="px-4 pt-1 pb-4 pl-12">
              <VariantEditor p={p} layout="table" {...rest} />
            </motion.div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function ProductCard({ p, open, toggle, archive, restore, ...rest }: RowProps) {
  const s = productSummary(p);
  const low = p.variants.filter((v) => v.stock < LOW_STOCK).length;
  const panelId = `m-variants-${p.id}`;
  return (
    <motion.li variants={listItem} className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <ProductImage src={coverImage(p)} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/products/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <p className="truncate text-[12px] text-subtle">
                {label(p.collection)} · {label(p.style)} · {p.lensTypes.map(label).join(", ")}
              </p>
            </div>
            <ProductStatusBadge status={p.status} />
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <dt className="text-subtle">Stock</dt>
              <dd className="font-medium tabular-nums">
                <StockCell n={s.totalStock} lowCount={low} />
              </dd>
            </div>
            <div>
              <dt className="text-subtle">Cost</dt>
              <dd className="font-medium whitespace-nowrap tabular-nums">{moneyRange(s.minCost, s.maxCost)}</dd>
            </div>
            <div>
              <dt className="text-subtle">Suggested</dt>
              <dd className="font-medium whitespace-nowrap tabular-nums">{moneyRange(s.minPrice, s.maxPrice)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
        <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => toggle(p.id)} icon={<ChevronRight className={clsx("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />}>
          {plural(p.variants.length, "variant")}
        </Button>
        <div className="flex items-center gap-0.5">
          <Link to={`/products/${p.id}`} className="inline-flex h-7.5 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Link>
          {p.status === "active" ? (
            <IconButton label={`Archive ${p.name}`} onClick={() => archive(p)}>
              <Archive className="size-3.5" aria-hidden />
            </IconButton>
          ) : (
            <IconButton label={`Restore ${p.name}`} onClick={() => restore(p)}>
              <ArchiveRestore className="size-3.5" aria-hidden />
            </IconButton>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={panelId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-t border-line bg-surface-2/50 p-3">
            <VariantEditor p={p} layout="list" {...rest} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function VariantEditor({
  p,
  layout,
  drafts,
  saving,
  importedBy,
  setDraft,
  discard,
  saveVariants,
}: Pick<RowProps, "p" | "drafts" | "saving" | "importedBy" | "setDraft" | "discard" | "saveVariants"> & { layout: "table" | "list" }) {
  const dirty = p.variants.filter((v) => isDirty(v, drafts[v.id]));
  const anySaving = p.variants.some((v) => saving.has(v.id));
  const n = importedBy[p.id];
  const prefix = layout === "table" ? "d" : "m";

  const onKey = (e: KeyboardEvent<HTMLInputElement>, v: Variant) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveVariants(p, v);
    } else if (e.key === "Escape") {
      setDraft(v, { stock: String(v.stock), cost: centsToDollars(v.wholesaleCost) });
    }
  };

  const inputs = (v: Variant) => {
    const d = draftFor(v, drafts[v.id]);
    const parsed = parseDraft(d);
    const cost = parsed.cost ?? v.wholesaleCost;
    const m = marginPct(cost, v.suggestedPrice);
    return {
      d,
      m,
      stockInvalid: parsed.stock === null,
      costInvalid: parsed.cost === null,
      stock: (
        <input
          id={`${prefix}-stock-${v.id}`}
          inputMode="numeric"
          value={d.stock}
          onChange={(e) => setDraft(v, { stock: e.target.value })}
          onKeyDown={(e) => onKey(e, v)}
          onFocus={(e) => e.target.select()}
          aria-invalid={parsed.stock === null}
          aria-label={layout === "table" ? `Stock for ${v.sku}` : undefined}
          className={clsx("field field-sm w-20 text-right tabular-nums", parsed.stock !== null && parsed.stock !== v.stock && "border-accent")}
        />
      ),
      cost: (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[12.5px] text-subtle" aria-hidden>
            $
          </span>
          <input
            id={`${prefix}-cost-${v.id}`}
            inputMode="decimal"
            value={d.cost}
            onChange={(e) => setDraft(v, { cost: e.target.value })}
            onKeyDown={(e) => onKey(e, v)}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              const c = dollarsToCents(d.cost);
              if (c !== null) setDraft(v, { cost: centsToDollars(c) });
            }}
            aria-invalid={parsed.cost === null}
            aria-label={layout === "table" ? `Wholesale cost in dollars for ${v.sku}` : undefined}
            className={clsx("field field-sm w-24 pl-5 text-right tabular-nums", parsed.cost !== null && parsed.cost !== v.wholesaleCost && "border-accent")}
          />
        </div>
      ),
    };
  };

  const marginTone = (m: number) => (m < 30 ? "text-danger" : m < 55 ? "text-warn" : "text-success");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 py-2">
        <p className="text-[12.5px] text-muted">
          {n === undefined ? "Checking imports…" : n > 0 ? `Imported by ${plural(n, "store")} — stock and cost changes sync on save.` : "Not imported by any store yet."}
          <span className="hidden sm:inline text-subtle"> Enter saves a row, Esc resets it.</span>
        </p>
        <div className="flex items-center gap-2">
          {dirty.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => discard(p)} disabled={anySaving}>
              Discard
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={!dirty.length} loading={anySaving} onClick={() => saveVariants(p)}>
            {dirty.length > 1 ? `Save ${dirty.length} changes` : "Save changes"}
          </Button>
        </div>
      </div>

      {layout === "table" ? (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Variants of {p.name}</caption>
            <thead>
              <tr>
                <th className="th" scope="col">
                  Variant
                </th>
                <th className="th" scope="col">
                  SKU
                </th>
                <th className="th" scope="col">
                  Size
                </th>
                <th className="th text-right" scope="col">
                  Stock
                </th>
                <th className="th text-right" scope="col">
                  Wholesale cost
                </th>
                <th className="th text-right" scope="col">
                  Suggested
                </th>
                <th className="th text-right" scope="col">
                  Margin
                </th>
                <th className="th w-0" scope="col">
                  <span className="sr-only">Save</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => {
                const f = inputs(v);
                const isD = isDirty(v, drafts[v.id]);
                return (
                  <tr key={v.id} className="[&:last-child>td]:border-b-0">
                    <td className="td py-2">
                      <span className="flex items-center gap-2">
                        <ColorPair frame={v.frameColorHex} lens={v.lensColorHex} frameName={v.frameColor} lensName={v.lensColor} />
                        <span>
                          {v.frameColor} <span className="text-subtle">/</span> {v.lensColor}
                        </span>
                      </span>
                    </td>
                    <td className="td py-2 font-mono text-[12px] text-muted">{v.sku}</td>
                    <td className="td py-2 text-muted">{v.size}</td>
                    <td className="td py-2">
                      <div className="flex items-center justify-end gap-2">
                        {v.stock < LOW_STOCK && !isD && <span className="text-[11px] font-medium text-warn">Low</span>}
                        {f.stock}
                      </div>
                    </td>
                    <td className="td py-2">
                      <div className="flex justify-end">{f.cost}</div>
                    </td>
                    <td className="td py-2 text-right text-muted tabular-nums">{money2(v.suggestedPrice)}</td>
                    <td className={clsx("td py-2 text-right font-medium tabular-nums", marginTone(f.m))}>{f.m.toFixed(1)}%</td>
                    <td className="td py-2 pl-0">
                      <Button size="sm" variant={isD ? "secondary" : "ghost"} disabled={!isD || f.stockInvalid || f.costInvalid} loading={saving.has(v.id)} onClick={() => saveVariants(p, v)} aria-label={`Save ${v.sku}`}>
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {p.variants.map((v) => {
            const f = inputs(v);
            const isD = isDirty(v, drafts[v.id]);
            return (
              <li key={v.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[13px]">
                    <ColorPair frame={v.frameColorHex} lens={v.lensColorHex} frameName={v.frameColor} lensName={v.lensColor} />
                    <span className="truncate">
                      {v.frameColor} / {v.lensColor}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-subtle">{v.sku}</span>
                </div>
                <div className="mt-2.5 flex items-end gap-3">
                  <div>
                    <label htmlFor={`${prefix}-stock-${v.id}`} className="label mb-1 text-[11.5px]">
                      Stock
                    </label>
                    {f.stock}
                  </div>
                  <div>
                    <label htmlFor={`${prefix}-cost-${v.id}`} className="label mb-1 text-[11.5px]">
                      Cost
                    </label>
                    {f.cost}
                  </div>
                  <div className="ml-auto text-right text-[12px]">
                    <div className="text-subtle">{money2(v.suggestedPrice)}</div>
                    <div className={clsx("font-medium tabular-nums", marginTone(f.m))}>{f.m.toFixed(1)}%</div>
                  </div>
                </div>
                {isD && (
                  <div className="mt-2.5 flex justify-end">
                    <Button size="sm" variant="primary" disabled={f.stockInvalid || f.costInvalid} loading={saving.has(v.id)} onClick={() => saveVariants(p, v)}>
                      Save {v.sku}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="h-9 border-b border-line bg-surface-2" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-3.5 w-16 md:block" />
          <Skeleton className="hidden h-3.5 w-20 md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
