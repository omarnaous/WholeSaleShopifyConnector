import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { formatMoney, marginPct, type ImportedRow } from "@lumen/core";
import { api, errorMessage } from "../api";
import { useShop } from "../shop";
import { adminProductHref, formatPct, formatRelative, pluralize, stockLabel, stockTone } from "../lib/util";
import { RowsSkeleton } from "../components/Skeleton";

const STATUS: Record<ImportedRow["status"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  DRAFT: { label: "Draft", tone: "warning" },
  ORPHANED: { label: "Deleted in Shopify", tone: "neutral" },
};

export function ImportedPage() {
  const { state } = useShop();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ImportedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    api.imported().then(
      (r) => live && (setRows(r), setError(null)),
      (e: unknown) => live && setError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const currency = state.plan.currency;

  return (
    <s-page heading="Imported products" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => navigate("/catalog")}>
        Browse catalog
      </s-button>

      <s-banner slot="supplemental-start" tone="info">
        <s-paragraph>Stock and cost per item sync automatically. Your prices, titles, descriptions and images are never changed after import.</s-paragraph>
      </s-banner>

      {error ? (
        <s-banner tone="critical" heading="Couldn't load imported products">
          <s-paragraph>{error}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </s-button>
        </s-banner>
      ) : !rows ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <s-section>
          <s-empty-state heading="No products imported yet">
            <s-icon slot="graphic" type="product-add" />
            <s-text slot="subheading">Pick frames from the Lumen catalog and add them to your store in one click.</s-text>
            <s-button slot="primary-action" variant="primary" onClick={() => navigate("/catalog")}>
              Browse the catalog
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-stack gap="base">
          <s-text color="subdued">{pluralize(rows.length, "product")}</s-text>
          {rows.map((row) => (
            <ImportedProduct key={row.productId} row={row} currency={currency} />
          ))}
        </s-stack>
      )}
    </s-page>
  );
}

function ImportedProduct({ row, currency }: { row: ImportedRow; currency: string }) {
  const status = STATUS[row.status];
  const alerts = row.variants.filter((v) => v.marginAlert).length;
  const orphaned = row.status === "ORPHANED";

  return (
    <s-section heading={row.name}>
      <s-badge slot="accessory" tone={status.tone}>
        {status.label}
      </s-badge>
      {!orphaned && (
        <s-button slot="secondary-actions" href={adminProductHref(row.shopifyProductId)} icon="external">
          Open in Shopify
        </s-button>
      )}

      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-thumbnail src={row.imageUrl ?? undefined} alt={row.name} size="small" />
          <s-stack gap="small-300">
            <s-text color="subdued">Last synced {formatRelative(row.lastSyncedAt)}</s-text>
            <s-stack direction="inline" gap="small-200">
              <s-text color="subdued">{pluralize(row.variants.length, "variant")}</s-text>
              {alerts > 0 && (
                <s-badge tone="critical" icon="alert-triangle">
                  {pluralize(alerts, "margin alert")}
                </s-badge>
              )}
            </s-stack>
          </s-stack>
        </s-stack>

        {orphaned && (
          <s-paragraph color="subdued">This product was deleted from your Shopify admin, so it no longer syncs. You can import it again from the catalog.</s-paragraph>
        )}

        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">Variant</s-table-header>
            <s-table-header listSlot="secondary">SKU</s-table-header>
            <s-table-header format="numeric">Stock</s-table-header>
            <s-table-header format="currency">Cost</s-table-header>
            <s-table-header format="currency">Your price</s-table-header>
            <s-table-header format="numeric">Margin</s-table-header>
            <s-table-header listSlot="inline">Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {row.variants.map((v) => (
              <s-table-row key={v.sku}>
                <s-table-cell>{v.label}</s-table-cell>
                <s-table-cell>
                  <s-text color="subdued">{v.sku}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-text tone={v.stock < 10 ? stockTone(v.stock) : "auto"} fontVariantNumeric="tabular-nums">
                    {v.stock}
                  </s-text>
                </s-table-cell>
                <s-table-cell>{formatMoney(v.cost, currency)}</s-table-cell>
                <s-table-cell>{v.price == null ? "—" : formatMoney(v.price, currency)}</s-table-cell>
                <s-table-cell>
                  {v.price == null ? (
                    "—"
                  ) : (
                    <s-text tone={v.marginAlert ? "critical" : "auto"} fontVariantNumeric="tabular-nums">
                      {formatPct(marginPct(v.cost, v.price))}
                    </s-text>
                  )}
                </s-table-cell>
                <s-table-cell>
                  {v.marginAlert ? (
                    <s-badge tone="critical">Cost ≥ price</s-badge>
                  ) : v.stock < 10 ? (
                    <s-badge tone={stockTone(v.stock)}>{stockLabel(v.stock)}</s-badge>
                  ) : (
                    <s-badge tone="success">Healthy</s-badge>
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-stack>
    </s-section>
  );
}
