import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { formatMoney, marginPct, type MarginAlertRow } from "@lumen/core";
import { api, errorMessage } from "../api";
import { useShop } from "../shop";
import { adminProductHref, formatPct, formatRelative, pluralize, toast } from "../lib/util";
import { RowsSkeleton } from "../components/Skeleton";

export function AlertsPage() {
  const { state, patch } = useShop();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MarginAlertRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissing, setDismissing] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let live = true;
    api.alerts().then(
      (r) => {
        if (!live) return;
        setRows(r);
        setError(null);
        patch({ openAlerts: r.length });
      },
      (e: unknown) => live && setError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
  }, [reloadKey, patch]);

  const dismiss = async (id: string) => {
    setDismissing((s) => new Set(s).add(id));
    try {
      await api.dismissAlert(id);
      setRows((r) => r && r.filter((x) => x.id !== id));
      patch((s) => ({ openAlerts: Math.max(0, s.openAlerts - 1) }));
      toast("Alert dismissed");
    } catch (e) {
      toast(errorMessage(e), { isError: true });
    } finally {
      setDismissing((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const currency = state.plan.currency;

  return (
    <s-page heading="Margin alerts" inlineSize="large">
      <s-banner slot="supplemental-start" tone="info">
        <s-paragraph>
          We flag a variant when its wholesale cost reaches or passes the price you sell it for. Raise the price in Shopify and the alert clears on the next sync.
        </s-paragraph>
      </s-banner>

      {error ? (
        <s-banner tone="critical" heading="Couldn't load alerts">
          <s-paragraph>{error}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </s-button>
        </s-banner>
      ) : !rows ? (
        <RowsSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <s-section>
          <s-empty-state heading="All margins healthy">
            <s-icon slot="graphic" type="check-circle" tone="success" />
            <s-text slot="subheading">Every imported variant sells above its wholesale cost. We'll let you know here if that changes.</s-text>
            <s-button slot="primary-action" variant="primary" onClick={() => navigate("/imported")}>
              View imported products
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section heading={pluralize(rows.length, "open alert")}>
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="secondary">Variant</s-table-header>
              <s-table-header format="currency">Wholesale cost</s-table-header>
              <s-table-header format="currency">Your price</s-table-header>
              <s-table-header format="numeric" listSlot="inline">
                Margin
              </s-table-header>
              <s-table-header>Since</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((a) => {
                const margin = marginPct(a.cost, a.price);
                return (
                  <s-table-row key={a.id} id={`alert-${a.id}`}>
                    <s-table-cell>
                      <s-text fontWeight="semibold">{a.productName}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack gap="small-500">
                        <s-text>{a.variantLabel}</s-text>
                        <s-text color="subdued" fontSize="small">
                          {a.sku}
                        </s-text>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{formatMoney(a.cost, currency)}</s-table-cell>
                    <s-table-cell>{formatMoney(a.price, currency)}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone="critical">{formatPct(margin)}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{formatRelative(a.createdAt)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-button href={adminProductHref(a.shopifyProductId)} variant="secondary" icon="edit">
                          Edit price in Shopify
                        </s-button>
                        <s-button variant="tertiary" loading={dismissing.has(a.id)} onClick={() => dismiss(a.id)}>
                          Dismiss
                        </s-button>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}
