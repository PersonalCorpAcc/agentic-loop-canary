import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The theme kit's components import each other as `@/components/...`, so the alias has to
  // resolve in the bundler as well as in TypeScript.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: { port: 5173 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
