import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Component tests: real Chromium via Playwright, mounting the components
// with the package's real CSS. Most run the contracts shared with React
// (../react/src/__tests__/contracts).
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: { include: ["svelte", "@material/web/all.js"] },
  test: {
    include: ["src/**/*.browser.test.ts"],
    setupFiles: ["src/__tests__/setup.browser.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }],
    },
  },
});
