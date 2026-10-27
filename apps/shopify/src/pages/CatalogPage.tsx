import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { CatalogFilters, ImportJobState } from "@lumen/core";
import { ApiError, api, errorMessage, type CatalogResult } from "../api";
import { useShop } from "../shop";
import { pluralize, toast, useDebounced } from "../lib/util";
import { ProductCard } from "../components/ProductCard";
import { CatalogFilterBar, hasActiveFilters } from "../components/CatalogFilters";
import { ImportProgress } from "../components/ImportProgress";
import { CardGridSkeleton } from "../components/Skeleton";

const POLL_MS = 800;

/** ORPHANED = the merchant deleted it in Shopify; the API lets it be imported again. */
const isSelectable = (p: CatalogResult["products"][number]) => !p.imported || p.imported.status === "ORPHANED";

export function CatalogPage() {
  const { state, refresh: refreshShop } = useShop();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [filters, setFilters] = useState<CatalogFilters>({});
  const query = useMemo<CatalogFilters>(() => ({ ...filters, q: q || undefined }), [filters, q]);

  const [data, setData] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const names = useRef(new Map<string, string>());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api
      .catalog(query, ctrl.signal)
      .then((res) => {
        for (const p of res.products) names.current.set(p.id, p.name);
        setData(res);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || (e instanceof ApiError && e.status === 402)) return;
        setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, reloadKey]);

  const products = data?.products ?? [];
  const selectable = useMemo(() => products.filter(isSelectable), [products]);

  // ── selection ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // Drop ids that are no longer selectable (e.g. just imported).
  useEffect(() => {
    if (!data) return;
    const ok = new Set(data.products.filter(isSelectable).map((p) => p.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ok.has(id) || !data.products.some((p) => p.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);
  const allVisibleSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const selectAll = () => setSelected((prev) => new Set([...prev, ...selectable.map((p) => p.id)]));
  const clear = () => setSelected(new Set());

  // ── import job ───────────────────────────────────────────────────────────
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJobState | null>(null);
  const running = Boolean(jobId) && job?.status !== "done" && job?.status !== "failed";

  const startImport = async () => {
    if (!selected.size || starting || running) return;
    const unfiltered = !hasActiveFilters(filters, search);
    const ids = [...selected];
    // With no filters and everything selected, let the server resolve the full catalog.
    const body = unfiltered && allVisibleSelected && ids.length === selectable.length ? ({ all: true } as const) : { productIds: ids };
    setStarting(true);
    try {
      const res = await api.importProducts(body);
      if (!res.jobId) {
        toast(res.skipped ? "Those products are already in your store" : "Nothing to import");
        setReloadKey((k) => k + 1);
        return;
      }
      setJob({ id: res.jobId, status: "queued", total: ids.length - res.skipped || ids.length, done: 0, failed: 0, errors: [] });
      setJobId(res.jobId);
      clear();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) toast(errorMessage(e), { isError: true });
    } finally {
      setStarting(false);
    }
  };

  const onFinished = useRef<(j: ImportJobState) => void>(() => undefined);
  onFinished.current = (j) => {
    if (j.done) toast(`${pluralize(j.done, "product")} imported to your store${j.failed ? ` · ${j.failed} failed` : ""}`);
    else toast("Import failed", { isError: true });
    setReloadKey((k) => k + 1);
    void refreshShop();
  };

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const j = await api.importJob(jobId);
        if (stopped) return;
        setJob(j);
        if (j.status === "done" || j.status === "failed") {
          onFinished.current(j);
          return;
        }
      } catch {
        // Transient (network blip, cold start): keep polling.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const dismissJob = () => {
    setJobId(null);
    setJob(null);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const filtered = hasActiveFilters(filters, search);
  const count = selected.size;
  const importLabel = count ? `Import ${pluralize(count, "product")}` : "Import products";

  return (
    <s-page heading="Catalog" inlineSize="large">
      <s-button slot="primary-action" variant="primary" disabled={!count || running} loading={starting} onClick={startImport}>
        {importLabel}
      </s-button>
      <s-button slot="secondary-actions" icon="alert-triangle" onClick={() => navigate("/alerts")}>
        {state.openAlerts ? `Margin alerts (${state.openAlerts})` : "Margin alerts"}
      </s-button>

      {!state.location && (
        <s-banner slot="supplemental-start" tone="warning" heading="No inventory location">
          <s-paragraph>Your store has no active location to hold stock, so imports will fail. Add a location in Settings › Locations.</s-paragraph>
        </s-banner>
      )}

      <s-stack gap="base">
        <s-section>
          <s-stack gap="base">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone="success" icon="product">
                {pluralize(state.importedCount, "product")} in your store
              </s-badge>
              {state.openAlerts > 0 ? (
                <s-clickable accessibilityLabel={`${state.openAlerts} open margin alerts, view`} onClick={() => navigate("/alerts")} borderRadius="base">
                  <s-badge tone="warning" icon="alert-triangle">
                    {pluralize(state.openAlerts, "margin alert")}
                  </s-badge>
                </s-clickable>
              ) : (
                <s-badge tone="neutral" icon="check-circle">
                  Margins healthy
                </s-badge>
              )}
              <s-text color="subdued">Stock and cost sync automatically after import.</s-text>
            </s-stack>
            <CatalogFilterBar filters={filters} search={search} onSearch={setSearch} onChange={setFilters} frameColors={data?.facets.frameColors ?? []} />
          </s-stack>
        </s-section>

        {job && <ImportProgress job={job} nameOf={(id) => names.current.get(id) ?? id} onDismiss={dismissJob} />}

        {loadError && (
          <s-banner tone="critical" heading="Couldn't load the catalog">
            <s-paragraph>{loadError}</s-paragraph>
            <s-button slot="secondary-actions" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </s-button>
          </s-banner>
        )}

        {!data && loading ? (
          <CardGridSkeleton />
        ) : products.length === 0 && !loadError ? (
          <s-section>
            <s-empty-state heading={filtered ? "No sunglasses match these filters" : "The catalog is being restocked"}>
              <s-icon slot="graphic" type={filtered ? "search" : "product"} />
              <s-text slot="subheading">
                {filtered ? "Try fewer filters or a different search term." : "New frames are added regularly. Check back soon."}
              </s-text>
              {filtered && (
                <s-button slot="primary-action" variant="primary" onClick={clearFilters}>
                  Clear filters
                </s-button>
              )}
            </s-empty-state>
          </s-section>
        ) : (
          <>
            <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
              <s-text color="subdued">
                {pluralize(products.length, "style")}
                {products.length !== selectable.length ? ` · ${products.length - selectable.length} already imported` : ""}
              </s-text>
              {loading && <s-spinner size="base" accessibilityLabel="Updating results" />}
            </s-stack>
            <div className="card-grid" data-loading={loading || undefined}>
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  selected={selected.has(p.id)}
                  selectable={isSelectable(p)}
                  onToggle={toggle}
                  currency={state.plan.currency}
                />
              ))}
            </div>
          </>
        )}

        {selectable.length > 0 && (
          <div className="action-bar" data-active={count > 0 || undefined}>
            <s-box background="base" border="base" borderRadius="large" padding="small-100 base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
                <s-text fontWeight="semibold" fontVariantNumeric="tabular-nums">
                  {count ? `${count} selected` : "Select products to import"}
                </s-text>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-button variant="tertiary" disabled={allVisibleSelected} onClick={selectAll}>
                    Select all ({selectable.length})
                  </s-button>
                  <s-button variant="tertiary" disabled={!count} onClick={clear}>
                    Clear
                  </s-button>
                  <s-button variant="primary" disabled={!count || running} loading={starting} onClick={startImport}>
                    {importLabel}
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          </div>
        )}
      </s-stack>
    </s-page>
  );
}
