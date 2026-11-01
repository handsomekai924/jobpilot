/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dev 代理到本地 server（jobpilot_server/config.py 的 DEFAULT_PORT = 8787）
const SERVER = "http://127.0.0.1:8787";

const SRC = decodeURIComponent(new URL("./src", import.meta.url).pathname)
  .replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": SRC },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: SERVER, changeOrigin: true, ws: true },
    },
  },
  build: {
    // 产物直接落 jobpilot_server/static/dist，PyInstaller 照常收集（改造文档第八节）
    outDir: "../../apps/server/src/jobpilot_server/static/dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
  },
});
