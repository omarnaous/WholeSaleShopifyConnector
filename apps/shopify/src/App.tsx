import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { isDemo, setSubscriptionRequiredHandler } from "./api";
import { ShopProvider, useShop } from "./shop";
import { AppSkeleton } from "./components/Skeleton";
import { CatalogPage } from "./pages/CatalogPage";
import { ImportedPage } from "./pages/ImportedPage";
import { AlertsPage } from "./pages/AlertsPage";
import { BillingPage } from "./pages/BillingPage";

/** `rel` is part of App Bridge's s-app-nav link contract but not of Polaris' s-link prop types. */
const HOME = { rel: "home" } as const;

export function App() {
  useAppBridgeNavigation();
  return (
    <>
      {/* App Bridge renders this in the Shopify admin sidebar; it is never shown inside the iframe. */}
      <s-app-nav>
        <s-link href="/" {...HOME}>
          Home
        </s-link>
        <s-link href="/catalog">Catalog</s-link>
        <s-link href="/imported">Imported products</s-link>
        <s-link href="/alerts">Margin alerts</s-link>
        <s-link href="/billing">Plan &amp; billing</s-link>
      </s-app-nav>

      <ShopProvider fallback={<AppSkeleton />} renderError={(message, retry) => <BootError message={message} retry={retry} />}>
        <Shell />
      </ShopProvider>

      {isDemo && (
        <div className="demo-ribbon" aria-hidden="true">
          <s-badge tone="info">Demo data</s-badge>
        </div>
      )}
    </>
  );
}

function Shell() {
  const { active, refresh } = useShop();
  const navigate = useNavigate();

  useEffect(() => {
    setSubscriptionRequiredHandler(() => {
      void refresh().then(() => navigate("/billing"));
    });
    return () => setSubscriptionRequiredHandler(null);
  }, [refresh, navigate]);

  // Without an ACTIVE subscription the only thing a merchant can do is subscribe.
  if (!active) return <BillingPage />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/catalog" replace />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/imported" element={<ImportedPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  );
}

/**
 * App Bridge handles clicks on s-app-nav links and dispatches `shopify:navigate` on the link element;
 * hand the href to react-router so we navigate client-side without reloading the iframe.
 */
function useAppBridgeNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const href = (e.target as Element | null)?.getAttribute?.("href");
      if (href) navigate(href);
    };
    document.addEventListener("shopify:navigate", onNavigate);
    return () => document.removeEventListener("shopify:navigate", onNavigate);
  }, [navigate]);
}

function BootError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <s-page heading="Lumen Wholesale">
      <s-banner tone="critical" heading="We couldn't load your store">
        <s-paragraph>{message}. If this keeps happening, reload the app from your Shopify admin.</s-paragraph>
        <s-button slot="secondary-actions" onClick={retry}>
          Try again
        </s-button>
      </s-banner>
    </s-page>
  );
}
