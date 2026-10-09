import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// No Chai-specific config on purpose: an app shouldn't need any.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5191 },
});
