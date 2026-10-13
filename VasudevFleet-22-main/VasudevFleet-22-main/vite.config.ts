import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createServer as createApiServer } from "./server/index";

function apiMiddlewarePlugin() {
  return {
    name: "fleetx-api-middleware",
    configureServer(server: { middlewares: { use: (middleware: unknown) => void } }) {
      server.middlewares.use(createApiServer());
    },
  };
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 8080,
    strictPort: true,
  },

  build: {
    outDir: "dist/spa",
  },
});