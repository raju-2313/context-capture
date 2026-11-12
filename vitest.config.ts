import { defineConfig } from "vitest/config";
import path from "path";
import { setupFakeIndexedDB } from "./tests/setup";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
