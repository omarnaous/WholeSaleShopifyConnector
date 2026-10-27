import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./styles.css";

const Render = lazy(() => import("./pages/Render"));
const Site = lazy(() => import("./Site"));

const router = createBrowserRouter([
  { path: "/render", element: <Suspense><Render /></Suspense> },
  { path: "*", element: <Suspense><Site /></Suspense> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
