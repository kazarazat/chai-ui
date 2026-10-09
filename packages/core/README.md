<p align="center">
  <a href="https://chai-ui.com"><img src="https://chai-ui.com/chai-wordmark.svg" alt="Chai UI" width="220" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chai-ui/core"><img src="https://img.shields.io/npm/v/@chai-ui/core?label=npm&color=009747" alt="npm version" /></a>
  <a href="https://github.com/kazarazat/chai-ui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://chai-ui.com/docs/"><img src="https://img.shields.io/badge/docs-chai--ui.com-009747" alt="Docs" /></a>
</p>

# @chai-ui/core

The headless core behind CHAI's components: the data types, the
Request → Run → Result model a submitted prompt flows through, and the
pluggable generation engines that actually call models, and the components'
behavior as small framework-free stores. No framework, no rendering:
`@chai-ui/react` wraps the stores in hooks, and a Vue binding will wrap the
same stores.

## Layout

- `types.ts` — shared types: `MediaKind`, `DroppedMedia`, `ModelOption`, `Usage`, `GenerationUseCase`.
- `run.ts` — `Request`/`Run`/`Result` plus pure transitions over them (`createRun`, `startResult`, `resolveResult`, `failResult`, `deriveGenerationUseCase`).
- `engine.ts` — the `GenerationEngine` interface every provider implements, `GenerationError`, and `mockEngine`/`createMockEngine` (placeholder output, no network call, no API key).
- `engines/fal.ts` — `createFalEngine`, media generation through Fal.ai (the default).
- `engines/openrouter.ts` — `createOpenRouterEngine`, text/reasoning through OpenRouter (prompt enhancement, media analysis).
- `media-analysis-prompts.ts` — the instruction text `MediaAnalyzer` sends, per media kind × prompt length.
- `suggested-models.ts` — the suggested model lists per use case (Fal for generation, OpenRouter for analysis), each model with its verified aspect ratios and Fal input format; `suggestedModels(useCase)`.
- `check-suggested-models.ts` — `checkSuggestedModels()`: checks those lists against Fal's and OpenRouter's catalogs as they are today. No key, no model run.
- `model-routing.ts` — auto-select: `buildModelRoutingPrompt`, `parseModelRoutingReply`, and `routeModel`, which falls back to the first listed model instead of throwing.
- `reasoning.ts` — the reasoning engine and models a `ChaiProvider` shares: `createReasoning`, `pickReasoning`, `reasoningModelFor` and the suggested defaults.
- `composer.ts` — `createComposerStore`, what `useComposer` wraps: submit payload → runs, auto-select routing, Enhance, cancel, and image edit versions. Plus the Composer's shared types (`ComposerSubmitPayload`, `EditVersion`, …).
- `media-analyzer.ts` — `createMediaAnalyzerStore`, what `useMediaAnalyzer` wraps.
- `server/` — `createChaiHandler` and `toNodeHandler`, exported from `@chai-ui/core/server` (server-only).

## Suggested models, and checking them

The components fill their Model menus from the suggested lists when a
builder passes none (see `@chai-ui/react`'s README). Each Fal model in them
carries `falInput`, read from its Fal schema: where the image goes
(`image_url`, `image_urls` or `start_image_url`) and how the aspect ratio
is sent (`aspect_ratio`, or a named `image_size`). `buildFalRequestBody`
uses it; for a model outside the lists it falls back to guessing from the
id.

The lists change only through package releases. `checkSuggestedModels()`
compares them with the providers right now, from a browser or Node, with
no key:

```ts
const { ok, checked, problems } = await checkSuggestedModels();
```

It reports a model that's gone or no longer active, a Fal model that no
longer takes an aspect ratio or image field Chai sends or now requires a
field Chai doesn't send, and an OpenRouter model that no longer accepts its
media kind. Fal's catalog is read 10 models a page (`api.fal.ai/v1/models`),
OpenRouter's from `openrouter.ai/api/v1/models`.

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

**Where it runs.** The route lives in your app's framework (React or Vue)
or on the API server behind it. Mount it at
`/api/chai`, where the components send their requests. `handle(request)`
takes a standard web `Request` and returns a `Response`; `GET`, `POST` and
`PUT` (Fal's cancel call) are the same function. When the browser
disconnects, the provider call is aborted too.

| Your setup | Add this |
|---|---|
| Next.js (App Router) | `export const { GET, POST, PUT } = createChaiHandler();` in `app/api/chai/[...path]/route.ts` |
| Remix / React Router | `export const loader = ({ request }) => chai.handle(request); export const action = loader;` in `app/routes/api.chai.$.ts` |
| Nuxt | `export default defineEventHandler((event) => chai.handle(toWebRequest(event)));` in `server/api/chai/[...path].ts` |
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
