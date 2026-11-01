/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_SERVER_PORT = 8787;
const DEV_PORT_FILE = resolve(fileURLToPath(new URL("..", import.meta.url)), "..", ".dev", "server-port");

function serverTarget(): string {
  const configured = Number(process.env.JOBPILOT_DEV_API_PORT);
  if (Number.isInteger(configured) && configured > 0 && configured <= 65535) {
    return `http://127.0.0.1:${configured}`;
  }
  try {
    const published = Number(readFileSync(DEV_PORT_FILE, "utf8").trim());
    if (Number.isInteger(published) && published > 0 && published <= 65535) {
      return `http://127.0.0.1:${published}`;
    }
  } catch {
    // The backend may not have started yet.
  }
  return `http://127.0.0.1:${DEFAULT_SERVER_PORT}`;
}

function useCurrentServer(proxy: Parameters<NonNullable<import("vite").ProxyOptions["configure"]>>[0]) {
  const web = proxy.web.bind(proxy);
  Object.defineProperty(proxy, "web", { value: new Proxy(web, {
    apply(target, thisArg, args: Parameters<typeof web>) {
      const options = args[2] && typeof args[2] === "object" ? args[2] : {};
      args[2] = { ...options, target: serverTarget() };
      return Reflect.apply(target, thisArg, args);
    },
  }) });

  const ws = proxy.ws.bind(proxy);
  Object.defineProperty(proxy, "ws", { value: new Proxy(ws, {
    apply(target, thisArg, args: Parameters<typeof ws>) {
      const options = args[3] && typeof args[3] === "object" ? args[3] : {};
      args[3] = { ...options, target: serverTarget() };
      return Reflect.apply(target, thisArg, args);
    },
  }) });
}

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
      "/api": { target: `http://127.0.0.1:${DEFAULT_SERVER_PORT}`, changeOrigin: true, ws: true, configure: useCurrentServer },
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
