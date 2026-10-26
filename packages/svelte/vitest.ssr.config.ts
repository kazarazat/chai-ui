import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Server rendering, as SvelteKit does it: Svelte's server build, in Node.
export default defineConfig({
  plugins: [svelte()],
  test: { environment: "node", include: ["src/**/*.ssr.test.ts"] },
});
