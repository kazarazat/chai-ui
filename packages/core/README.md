# @chai-ui/core

The headless core behind CHAI's components: the data types, the
Request → Run → Result model a submitted prompt flows through, and the
pluggable generation engines that actually call models. No framework, no
rendering — `@chai-ui/react` is one binding of this; a future non-React
binding would depend on this package the same way.

## Layout

- `types.ts` — shared types: `MediaKind`, `DroppedMedia`, `ModelOption`, `Usage`, `GenerationUseCase`.
- `run.ts` — `Request`/`Run`/`Result` plus pure transitions over them (`createRun`, `startResult`, `resolveResult`, `failResult`, `deriveGenerationUseCase`).
- `engine.ts` — the `GenerationEngine` interface every provider implements, `GenerationError`, and `mockEngine`/`createMockEngine` (placeholder output, no network call, no API key).
- `engines/fal.ts` — `createFalEngine`, media generation through Fal.ai (the default).
- `engines/openrouter.ts` — `createOpenRouterEngine`, text/reasoning through OpenRouter (prompt enhancement, media analysis).
- `media-analysis-prompts.ts` — the instruction text `MediaAnalyzer` sends, per media kind × prompt length.
- `model-routing.ts` — auto-select: `buildModelRoutingPrompt`, `parseModelRoutingReply`, and `routeModel`, which falls back to the first listed model instead of throwing.
- `server/` — `createChaiHandler` and `toNodeHandler`, exported from `@chai-ui/core/server` (server-only).

## The server route: `@chai-ui/core/server`

The built-in engines never hold an API key. They call one route on your
server, `/api/chai/*`, and `createChaiHandler` serves it: it adds the key
and forwards the request to Fal.ai or OpenRouter, streaming replies
through.

```ts
// Next.js: app/api/chai/[...path]/route.ts
import { createChaiHandler } from "@chai-ui/core/server";

export const { GET, POST, PUT } = createChaiHandler();
```

Set `FAL_KEY` and `OPENROUTER_API_KEY` in the server's environment (never
with a `VITE_` or `NEXT_PUBLIC_` prefix). A missing key comes back as a
clear error, e.g. "FAL_KEY isn't set on the server."

**Frameworks.** `handle(request)` takes a web `Request` and returns a
`Response`; `GET`, `POST` and `PUT` (Fal's cancel call) are the same
function. When the browser disconnects, the provider call is aborted too.

| Framework | Mount at `/api/chai` |
|---|---|
| Next.js (App Router) | `export const { GET, POST, PUT } = createChaiHandler();` in `app/api/chai/[...path]/route.ts` |
| Remix / React Router | `export const loader = ({ request }) => chai.handle(request); export const action = loader;` in `app/routes/api.chai.$.ts` |
| SvelteKit | `export const GET = ({ request }) => chai.handle(request); export const POST = GET, PUT = GET;` in `src/routes/api/chai/[...path]/+server.ts` |
| Hono | `app.all("/api/chai/*", (c) => chai.handle(c.req.raw))` |
| Bun, Deno | route `/api/chai/*` to `chai.handle` in `Bun.serve` / `Deno.serve` |
| Cloudflare Workers | `createChaiHandler({ falKey: env.FAL_KEY, openRouterKey: env.OPENROUTER_API_KEY }).handle(request)` |
| Express, plain Node | `app.use("/api/chai", toNodeHandler(createChaiHandler()))` |

**Before going live**, limit who can use the route and what it runs.
Without these, anyone who reaches your site can spend your API credit:

```ts
createChaiHandler({
  authorize: async (request) => Boolean(await getSession(request)), // false → 403
  allowedModels: ["fal-ai/flux/schnell", "anthropic/claude-opus-5"], // anything else → 403
});
```

Never import `@chai-ui/core/server` from browser code.

## Writing an engine

One method: a prompt plus any attached media in, one piece of output back.

```ts
import type { GenerationEngine } from "@chai-ui/core";

const myEngine: GenerationEngine = {
  async generate({ modelId, prompt, attachments }) {
    // call your provider…
    return { src: "https://…/output.png", kind: "image" };
  },
};
```

Throw a `GenerationError(message, reasons?)` to fail a call with
user-facing content rather than a bare network error. API keys never
belong in an engine: call a server route that adds the key, like
`createChaiHandler` above.
