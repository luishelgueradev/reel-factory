import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolves shared imports from the renderer source directory
      // The editor components import from "../../pipeline-config.js" and "../../fonts.js"
      // which at build time resolve to the shared renderer source files copied into src/
      // In Docker, these files are already in src/ (via the COPY step in Dockerfile)
    },
  },
  // public/ directory at project root serves static assets like sample-video.mp4
  // Per D-06: sample video for preview page, served at root path by Vite dev server
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: "../../dist/editor",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3123",
    },
  },
});