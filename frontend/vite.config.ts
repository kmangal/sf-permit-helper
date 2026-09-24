import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  // Production serves the build with `vite preview` (see start.sh); it reuses
  // server.proxy. Railway's public domains and its healthcheck host
  // (healthcheck.railway.app) are both under .railway.app.
  preview: {
    allowedHosts: [".railway.app"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
