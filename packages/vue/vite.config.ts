import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// Builds the .vue files into plain ESM. Vue, the other Chai packages and
// the Material web components stay imports, resolved by the app's bundler.
export default defineConfig({
  plugins: [
    vue({
      // `<md-*>` tags are Material web components, not Vue components.
      template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("md-") } },
    }),
  ],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    sourcemap: true,
    // Readable output, like the React package's: the app's bundler minifies.
    minify: false,
    rollupOptions: { external: [/^vue$/, /^@chai-ui\//, /^@material\/web\//] },
  },
  test: {
    environment: "jsdom",
  },
});
