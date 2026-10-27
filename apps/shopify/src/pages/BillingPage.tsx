import { useEffect, useRef, useState } from "react";
import { formatMoney, type SubscriptionStatus } from "@lumen/core";
import { api, errorMessage } from "../api";
import { useShop } from "../shop";
import { formatDate, pluralize, toast } from "../lib/util";

/** Statuses where the store had a subscription and lost it: imported products were moved to Draft. */
const LAPSED: SubscriptionStatus[] = ["CANCELLED", "FROZEN", "EXPIRED", "DECLINED"];

const STATUS_COPY: Record<SubscriptionStatus, { label: string; tone: "success" | "info" | "warning" | "critical" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  ACCEPTED: { label: "Approved — activating", tone: "info" },
  PENDING: { label: "Awaiting approval", tone: "info" },
  DECLINED: { label: "Declined", tone: "critical" },
  EXPIRED: { label: "Expired", tone: "warning" },
  FROZEN: { label: "Frozen", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "warning" },
  NONE: { label: "Not subscribed", tone: "neutral" },
};

const LAPSED_COPY: Partial<Record<SubscriptionStatus, string>> = {
  CANCELLED: "Your subscription was cancelled.",
  FROZEN: "Your subscription is frozen because your Shopify store's billing is on hold.",
  EXPIRED: "The subscription approval expired before it was accepted.",
  DECLINED: "The subscription charge was declined.",
};

export function BillingPage() {
  const { active } = useShop();
  return active ? <ActivePlan /> : <Paywall />;
}

function Paywall() {
  const { state } = useShop();
  const { plan, subscription } = state;
  const [loading, setLoading] = useState(false);
  const lapsed = LAPSED.includes(subscription.status);
  const pending = subscription.status === "PENDING" || subscription.status === "ACCEPTED";

  const subscribe = async () => {
    setLoading(true);
    try {
      const { confirmationUrl } = await api.subscribe();
      // We're inside the admin iframe: the approval page must replace the whole admin window.
      window.open(confirmationUrl, "_top");
    } catch (e) {
      toast(errorMessage(e), { isError: true });
      setLoading(false);
    }
  };

  return (
    <s-page heading="Plan & billing">
      {lapsed && (
        <s-banner slot="supplemental-start" tone="warning" heading="Your imported products are paused">
          <s-paragraph>
            {LAPSED_COPY[subscription.status]} {state.importedCount > 0 ? `Your ${pluralize(state.importedCount, "imported product")} were` : "Imported products are"} set to
            Draft so they're hidden from your storefront. Subscribe again and they'll be restored to Active automatically — with your prices and edits intact.
          </s-paragraph>
        </s-banner>
      )}
      {pending && (
        <s-banner slot="supplemental-start" tone="info" heading="Waiting for approval">
          <s-paragraph>We haven't received the approved charge yet. If you closed the approval page, start again below.</s-paragraph>
        </s-banner>
      )}

      <s-section heading={plan.name}>
        <s-badge slot="accessory" tone={STATUS_COPY[subscription.status].tone}>
          {STATUS_COPY[subscription.status].label}
        </s-badge>
        <s-stack gap="large">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="baseline">
              <s-heading>
                <span className="plan-price">{formatMoney(plan.price, plan.currency)}</span>
              </s-heading>
              <s-text color="subdued">/ month, billed through Shopify</s-text>
            </s-stack>
            {plan.trialDays > 0 && !lapsed && (
              <s-text tone="success" fontWeight="semibold">
                {plan.trialDays}-day free trial — cancel anytime before it ends and you won't be charged.
              </s-text>
            )}
          </s-stack>

          <ValueProps />

          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button variant="primary" loading={loading} onClick={subscribe}>
              {lapsed ? "Resubscribe" : plan.trialDays > 0 ? `Start ${plan.trialDays}-day free trial` : "Subscribe"}
            </s-button>
            <s-text color="subdued">You'll approve the charge on a Shopify page, then come right back here.</s-text>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

function ValueProps() {
  const catalogSize = useCatalogSize();
  const items: [string, string][] = [
    [`A curated catalog of ${catalogSize ?? "40+"} sunglasses`, "Aviators, wayfarers, sport and oversized frames with real photography, ready to import in one click."],
    ["Automatic stock and cost sync", "Inventory and per-item cost update on their own, so you never sell what's out of stock."],
    ["Margin alerts", "We flag any variant where the wholesale cost catches up with your selling price."],
    ["Your prices stay yours", "After import, your prices, titles, descriptions and images are never overwritten."],
  ];
  return (
    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
      {items.map(([title, body]) => (
        <s-box key={title} padding="base" background="subdued" borderRadius="base">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-icon type="check-circle" tone="success" size="small" />
              <s-text fontWeight="semibold">{title}</s-text>
            </s-stack>
            <s-text color="subdued">{body}</s-text>
          </s-stack>
        </s-box>
      ))}
    </s-grid>
  );
}

/** /api/app/catalog is gated behind billing, so the paywall counts the public showcase catalog instead. */
function useCatalogSize() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    api.publicCatalogSize().then((size) => live && setN(size), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  return n;
}

function ActivePlan() {
  const { state, refresh } = useShop();
  const { plan, subscription } = state;
  const [cancelling, setCancelling] = useState(false);
  const modal = useRef<HTMLElementTagNameMap["s-modal"]>(null);

  const cancel = async () => {
    setCancelling(true);
    try {
      await api.cancel();
      modal.current?.hideOverlay();
      toast("Subscription cancelled. Imported products were set to Draft.");
      await refresh();
    } catch (e) {
      toast(errorMessage(e), { isError: true });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <s-page heading="Plan & billing">
      <s-section heading={plan.name}>
        <s-badge slot="accessory" tone={STATUS_COPY[subscription.status].tone}>
          {STATUS_COPY[subscription.status].label}
        </s-badge>
        {subscription.test && (
          <s-badge slot="supplemental" tone="info" icon="info">
            Test charge
          </s-badge>
        )}
        <s-stack gap="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
            <Stat label="Price" value={`${formatMoney(plan.price, plan.currency)} / month`} />
            <Stat label="Current period ends" value={formatDate(subscription.currentPeriodEnd)} />
            <Stat label="Imported products" value={String(state.importedCount)} />
            <Stat label="Inventory location" value={state.location?.name ?? "Not set"} />
          </s-grid>
          {subscription.test && (
            <s-text color="subdued">This store is on a test charge (development store or BILLING_TEST=true). No money changes hands.</s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Cancel subscription">
        <s-stack gap="base">
          <s-paragraph color="subdued">
            Cancelling sets every imported product to Draft so nothing sells without stock sync. Resubscribe anytime to restore them.
          </s-paragraph>
          <s-stack direction="inline">
            <s-button tone="critical" commandFor="cancel-subscription-modal" command="--show">
              Cancel subscription
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-modal ref={modal} id="cancel-subscription-modal" heading="Cancel your subscription?">
        <s-stack gap="base">
          <s-paragraph>
            Your {pluralize(state.importedCount, "imported product")} will be set to Draft and hidden from your storefront. Stock and cost sync stops until you
            resubscribe.
          </s-paragraph>
          <s-paragraph color="subdued">Prices and edits you made are kept and restored when you subscribe again.</s-paragraph>
        </s-stack>
        <s-button slot="secondary-actions" commandFor="cancel-subscription-modal" command="--hide">
          Keep subscription
        </s-button>
        <s-button slot="primary-action" variant="primary" tone="critical" loading={cancelling} onClick={cancel}>
          Cancel subscription
        </s-button>
      </s-modal>
    </s-page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack gap="small-300">
        <s-text color="subdued">{label}</s-text>
        <s-text fontWeight="semibold">{value}</s-text>
      </s-stack>
    </s-box>
  );
}
