import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Component tests run in a real browser (vitest.browser.config.ts):
    // jsdom can't run the Material web components reliably.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.browser.test.tsx"],
  },
});
