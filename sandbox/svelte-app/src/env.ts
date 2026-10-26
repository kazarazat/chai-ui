// Copied from packages/svelte/README.md (check-docs keeps them the same).
// src/env.ts: the keys the route reads. Each is optional: set the ones you use.
import { defineEnvVars } from "@sveltejs/kit/env";

const optional = (value: string | undefined) => value;
export const variables = defineEnvVars({
  FAL_KEY: { schema: optional },
  OPENROUTER_API_KEY: { schema: optional },
  AI_GATEWAY_API_KEY: { schema: optional },
});
