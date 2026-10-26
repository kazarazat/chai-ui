// Copied from packages/svelte/README.md (check-docs keeps them the same).
// src/routes/api/chai/[...path]/+server.ts
import { AI_GATEWAY_API_KEY, FAL_KEY, OPENROUTER_API_KEY } from "$app/env/private";
import { createChaiHandler } from "@chai-ui/core/server";
import type { RequestHandler } from "./$types";

const chai = createChaiHandler({ falKey: FAL_KEY, openRouterKey: OPENROUTER_API_KEY, aiGatewayKey: AI_GATEWAY_API_KEY });
export const fallback: RequestHandler = ({ request }) => chai.handle(request);
