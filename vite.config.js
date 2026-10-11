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
  // Bound parallel WASM/geometry workloads; fixed-frame regressions can exceed
  // five wall-clock seconds on busy runners without any gameplay timing change.
  test: { environment: "node", maxWorkers: 4, testTimeout: 30000, exclude: ["**/node_modules/**", ".claude/**"] },
});

