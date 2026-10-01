import { defineConfig } from "vitest/config";

// Component tests: real Chromium via Playwright, mounting the components
// with the package's real CSS and Material web components.
export default defineConfig({
  // Pre-bundled up front, so Vite doesn't reload mid-run on first sight of them.
  optimizeDeps: { include: ["react", "react-dom", "react/jsx-dev-runtime", "@lit/react", "@material/web/all.js"] },
  test: {
    include: ["src/**/*.browser.test.tsx"],
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
