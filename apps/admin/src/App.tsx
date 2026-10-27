import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "./components/Auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { OverviewPage } from "./pages/Overview";
import { ProductsPage } from "./pages/Products";
import { ProductEditorPage } from "./pages/ProductEditor";
import { StoresPage } from "./pages/Stores";
import { JobsPage } from "./pages/Jobs";
import { NotFoundPage } from "./pages/NotFound";

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Overview"],
  [/^\/products\/new$/, "New product"],
  [/^\/products\/.+/, "Edit product"],
  [/^\/products$/, "Products"],
  [/^\/stores$/, "Stores"],
  [/^\/jobs$/, "Sync jobs"],
  [/^\/login$/, "Sign in"],
];

export function App() {
  const { token } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? "Not found";
    document.title = `${t} · LUMEN Admin`;
  }, [location.pathname]);

  if (!token) {
    if (location.pathname === "/login") return <LoginPage />;
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from: from === "/" ? undefined : from }} />;
  }
  if (location.pathname === "/login") return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/"} replace />;

  // Key on the first path segment so typing in the editor (which never changes it) doesn't remount.
  const section = location.pathname.split("/").slice(0, 3).join("/");

  return (
    <Layout>
      <motion.div key={section} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
        <Routes location={location}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductEditorPage />} />
          <Route path="/products/:id" element={<ProductEditorPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </Layout>
  );
}
