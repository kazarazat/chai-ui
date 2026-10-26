import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// No Chai-specific config on purpose: an app shouldn't need any. The Node
// adapter gives a real server, so pack-test can check the server render.
export default defineConfig({ plugins: [sveltekit({ adapter: adapter() })] });
