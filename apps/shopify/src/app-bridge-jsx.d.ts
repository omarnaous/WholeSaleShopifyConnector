/**
 * @shopify/app-bridge-types declares its elements (`s-app-nav`, `ui-nav-menu`, …) on the *global* `JSX`
 * namespace. With React 19 and `jsx: react-jsx`, TypeScript reads `React.JSX` instead, so we re-export the
 * one App Bridge element we use there. (Polaris elements are already registered on `React.JSX` by
 * @shopify/polaris-types.)
 */
import type { SAppNavAttributes } from "@shopify/app-bridge-types";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": SAppNavAttributes;
    }
  }
}
