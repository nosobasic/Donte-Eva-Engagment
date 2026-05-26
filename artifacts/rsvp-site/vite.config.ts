import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { rsvpApiDevPlugin } from "./vite-rsvp-api-plugin";

const isReplit = process.env.REPL_ID !== undefined;
const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";
const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");

  const replitPlugins =
    isReplit && mode !== "production"
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          (await import("@replit/vite-plugin-cartographer")).cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : [];

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "development" ? [rsvpApiDevPlugin(env)] : []),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true, allow: [repoRoot] },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
};
});
