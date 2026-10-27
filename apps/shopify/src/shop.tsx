import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSubscriptionActive, type ShopState } from "@lumen/core";
import { api, errorMessage } from "./api";

interface ShopContextValue {
  state: ShopState;
  active: boolean;
  /** Re-reads /state (subscription status, counts). Resolves once the new state is applied. */
  refresh: () => Promise<void>;
  patch: (p: StatePatch | ((s: ShopState) => StatePatch)) => void;
}

type StatePatch = Partial<Pick<ShopState, "openAlerts" | "importedCount">>;

const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop outside <ShopProvider>");
  return ctx;
}

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; state: ShopState };

/**
 * Bootstraps the app with GET /api/app/state. The first call for a store also performs the token exchange
 * (install) on the server, so it can take a moment — `fallback` renders meanwhile.
 */
export function ShopProvider({ children, fallback, renderError }: { children: ReactNode; fallback: ReactNode; renderError: (message: string, retry: () => void) => ReactNode }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const refresh = useCallback(async () => {
    try {
      const state = await api.state();
      setLoad({ kind: "ready", state });
    } catch (e) {
      setLoad((prev) => (prev.kind === "ready" ? prev : { kind: "error", message: errorMessage(e) }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback<ShopContextValue["patch"]>((p) => {
    setLoad((prev) => (prev.kind === "ready" ? { kind: "ready", state: { ...prev.state, ...(typeof p === "function" ? p(prev.state) : p) } } : prev));
  }, []);

  const value = useMemo<ShopContextValue | null>(
    () => (load.kind === "ready" ? { state: load.state, active: isSubscriptionActive(load.state.subscription.status), refresh, patch } : null),
    [load, refresh, patch],
  );

  if (load.kind === "loading") return <>{fallback}</>;
  if (load.kind === "error")
    return (
      <>
        {renderError(load.message, () => {
          setLoad({ kind: "loading" });
          void refresh();
        })}
      </>
    );
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
