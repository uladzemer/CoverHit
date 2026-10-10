import { defineConfig } from "vite";

import { stockAssetFilterPlugin } from "./scripts/stock-build.mjs";

export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/; CI sets COVERHIT_BASE=/<repo>/.
  base: process.env.COVERHIT_BASE || "/",
  plugins: [stockAssetFilterPlugin()],
  build: {
    rollupOptions: { input: { main: "index.html", beaters: "beaters.html" }, output: { manualChunks: { three: ["three"] } } },
  },
  server: { watch: { ignored: ["**/.playwright-mcp/**", "**/.claude/**"] } },
  test: { environment: "node", exclude: ["**/node_modules/**", ".claude/**"] },
});

