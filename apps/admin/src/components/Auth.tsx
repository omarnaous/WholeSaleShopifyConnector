import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler, tokenStore } from "../api";

interface AuthState {
  token: string | null;
  signIn: (token: string) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** Reads the exp claim without verifying: only used to skip a doomed first request. */
function isExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const t = tokenStore.get();
    if (t && isExpired(t)) {
      tokenStore.set(null);
      return null;
    }
    return t;
  });

  useEffect(() => setUnauthorizedHandler(() => setToken(null)), []);

  const signIn = useCallback((t: string) => {
    tokenStore.set(t);
    setToken(t);
  }, []);
  const signOut = useCallback(() => {
    tokenStore.set(null);
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, signIn, signOut }), [token, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
