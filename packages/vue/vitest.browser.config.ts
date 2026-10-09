import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// Component tests: real Chromium via Playwright, mounting the components
// with the package's real CSS. Most run the contracts shared with React
// (../react/src/__tests__/contracts).
export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("md-") } } })],
  optimizeDeps: { include: ["vue", "@material/web/all.js"] },
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
