import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // CORS on the API allows http://localhost:5174, so bind to that exact origin.
  server: { host: "localhost", port: 5174, strictPort: true },
  preview: { host: "localhost", port: 5174 },
  build: { target: "es2022", sourcemap: true },
});
