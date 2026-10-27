import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { isDemo } from "./api";
import { App } from "./App";
import "./styles.css";

// Outside the Shopify admin there is no App Bridge `shopify` global; demo mode installs a tiny stand-in.
const ready = isDemo ? import("./demo/shim").then((m) => m.installShopifyShim()) : Promise.resolve();

void ready.then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
