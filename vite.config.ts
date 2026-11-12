import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    preact(),
    {
      name: "copy-extension-assets",
      generateBundle() {
        if (fs.existsSync(path.resolve(__dirname, "manifest.json"))) {
          this.emitFile({
            type: "asset",
            fileName: "manifest.json",
            source: fs.readFileSync(path.resolve(__dirname, "manifest.json"), "utf-8"),
          });
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "sidepanel/index.html"),
        popup: path.resolve(__dirname, "popup/index.html"),
        options: path.resolve(__dirname, "options/index.html"),
        offscreen: path.resolve(__dirname, "offscreen/offscreen.html"),
        background: path.resolve(__dirname, "src/background/index.ts"),
        injected: path.resolve(__dirname, "src/injected/readSelection.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "injected") return "injected/readSelection.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
