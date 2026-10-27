import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "localhost" },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // three.js only ships with the lazily loaded hero/render chunks.
        manualChunks(id) {
          if (/node_modules\/(three|@react-three)/.test(id)) return "three";
          if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)/.test(id)) return "motion";
        },
      },
    },
  },
});
