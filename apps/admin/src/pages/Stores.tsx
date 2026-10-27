import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { RefreshCw, Store } from "lucide-react";
import type { AdminStoreRow } from "@lumen/core";
import { api } from "../api";
import { useAsync } from "../lib/useAsync";
import { dateShort, plural, timeAgo } from "../lib/format";
import { useToast } from "../components/Toast";
import { SubscriptionBadge } from "../components/badges";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { listItem, listParent } from "../components/motion";

export function StoresPage() {
  const toast = useToast();
  const stores = useAsync(api.stores);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(
    () => [...(stores.data ?? [])].sort((a, b) => Number(!!a.uninstalledAt) - Number(!!b.uninstalledAt) || b.installedAt.localeCompare(a.installedAt)),
    [stores.data],
  );
  const installed = rows.filter((r) => !r.uninstalledAt);
  const active = installed.filter((r) => r.subscriptionStatus === "ACTIVE").length;

  async function resync(s: AdminStoreRow) {
    setBusy(s.id);
    try {
      const { queued } = await api.resyncStore(s.id);
      toast.success(queued ? `Resync queued · ${plural(queued, "job")}` : "Nothing to resync", queued ? `Pushing current stock and cost to ${s.shop}` : `${s.shop} hasn't imported any products.`);
      void stores.reload();
    } catch (e) {
      toast.error("Couldn't start resync", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Stores"
        description={
          stores.data ? `${plural(installed.length, "installed store")} · ${active} with an active subscription.` : "Shopify stores subscribed to the catalog."
        }
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw className={clsx("size-3.5", stores.loading && "animate-spin")} aria-hidden />} onClick={() => stores.reload()}>
            Refresh
          </Button>
        }
      />

      {stores.error ? (
        <ErrorState error={stores.error} onRetry={stores.reload} />
      ) : !stores.data ? (
        <div className="card space-y-0 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="ml-auto h-7 w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Store className="size-5" aria-hidden />} title="No stores yet">
            Stores appear here once a merchant installs the LUMEN Shopify app.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13.5px]">
              <caption className="sr-only">Subscriber stores</caption>
              <thead>
                <tr>
                  <th className="th pl-4" scope="col">
                    Store
                  </th>
                  <th className="th" scope="col">
                    Subscription
                  </th>
                  <th className="th text-right" scope="col">
                    Imported
                  </th>
                  <th className="th" scope="col">
                    Installed
                  </th>
                  <th className="th" scope="col">
                    Last sync
                  </th>
                  <th className="th pr-4 text-right" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={listParent} initial="hidden" animate="show">
                {rows.map((s) => {
                  const gone = !!s.uninstalledAt;
                  return (
                    <motion.tr key={s.id} variants={listItem} className={clsx("transition-colors hover:bg-surface-2/40", gone && "text-muted")}>
                      <td className="td pl-4">
                        <div className="flex items-center gap-3">
                          <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-lg border border-line text-[12px] font-semibold uppercase", gone ? "bg-surface-2 text-subtle" : "bg-surface text-fg")} aria-hidden>
                            {s.shop.slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <a
                              href={`https://${s.shop}/admin`}
                              target="_blank"
                              rel="noreferrer"
                              className={clsx("font-medium hover:underline hover:underline-offset-4", gone ? "text-muted line-through decoration-subtle/60" : "text-fg")}
                            >
                              {s.shop}
                              <span className="sr-only"> (opens Shopify admin in a new tab)</span>
                            </a>
                            {gone && (
                              <div className="mt-0.5">
                                <Badge tone="grey">Uninstalled {timeAgo(s.uninstalledAt)}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <SubscriptionBadge status={s.subscriptionStatus} />
                      </td>
                      <td className="td text-right tabular-nums">{s.importedProducts}</td>
                      <td className="td whitespace-nowrap">
                        <time dateTime={s.installedAt} title={new Date(s.installedAt).toLocaleString()}>
                          {dateShort(s.installedAt)}
                        </time>
                      </td>
                      <td className="td whitespace-nowrap text-muted">
                        {s.lastSyncAt ? (
                          <time dateTime={s.lastSyncAt} title={new Date(s.lastSyncAt).toLocaleString()}>
                            {timeAgo(s.lastSyncAt)}
                          </time>
                        ) : (
                          "Never"
                        )}
                      </td>
                      <td className="td pr-4 text-right">
                        <Button
                          size="sm"
                          icon={<RefreshCw className={clsx("size-3.5", busy === s.id && "animate-spin")} aria-hidden />}
                          disabled={gone || busy === s.id}
                          onClick={() => resync(s)}
                          aria-label={`Resync ${s.shop}`}
                          title={gone ? "Store uninstalled the app" : "Push current stock and cost for every imported product"}
                        >
                          Resync
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-subtle">Resync clears the last-synced markers and re-pushes stock and wholesale cost for every product a store imported.</p>
    </>
  );
}
