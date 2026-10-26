import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Unit tests only: the package itself is built by `svelte-package`, which
// ships the .svelte files for the app's own Svelte compiler.
export default defineConfig({
  plugins: [svelte()],
  // Svelte's client runtime, not its server one, in jsdom.
  resolve: { conditions: ["browser"] },
  test: {
    environment: "jsdom",
    // Component tests run in a real browser (vitest.browser.config.ts).
    exclude: ["**/node_modules/**", "**/dist/**", "**/.svelte-kit/**", "**/*.browser.test.ts"],
  },
});
