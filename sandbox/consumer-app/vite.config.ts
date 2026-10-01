import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deliberately no workspace-aware config here (no base path, no proxy
// plugins) — this app exists to prove @chai-ui/* work as a real installed
// dependency, so it should look like any external project would, not like
// a special-cased part of this monorepo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
  },
});
