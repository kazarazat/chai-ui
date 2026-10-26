<p align="center">
  <a href="https://chai-ui.com"><img src="https://chai-ui.com/chai-wordmark.svg" alt="Chai UI" width="220" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chai-ui/svelte"><img src="https://img.shields.io/npm/v/@chai-ui/svelte?label=npm&color=009747" alt="npm version" /></a>
  <a href="https://github.com/kazarazat/chai-ui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://chai-ui.com/docs/"><img src="https://img.shields.io/badge/docs-chai--ui.com-009747" alt="Docs" /></a>
</p>

# @chai-ui/svelte

Chai UI for Svelte: drop-in components for the input and output surfaces of
generative-media apps: a prompt composer, a media-to-prompt analyzer, a result card and an
edit card, with the AI work built in and wired to Fal.ai, OpenRouter, Vercel
AI Gateway or your own engine. Everything is controlled: you own the state,
and the components render it.

These are the same components as [`@chai-ui/react`](https://www.npmjs.com/package/@chai-ui/react)
and [`@chai-ui/vue`](https://www.npmjs.com/package/@chai-ui/vue), with the
same behavior and the same prop names. All three are thin layers over
`@chai-ui/core` and run one shared test suite, including the WCAG 2.2 AA
checks (axe, keyboard and focus).

Building with it, or pointing a coding agent at it? Read
[`DESIGN.md`](./DESIGN.md) (shipped in the package) for the usage rules,
and the docs site's [`llms.txt`](https://chai-ui.com/docs/llms.txt) for
the API. The code boxes on [chai-ui.com/docs](https://chai-ui.com/docs)
switch between React, Vue and Svelte.

## Install

```sh
pnpm add @chai-ui/svelte @chai-ui/core @chai-ui/tokens
```

Svelte 5, in SvelteKit or a plain Svelte app. No Chai-specific build setup:
the package ships `.svelte` files that your app compiles, and the
components render on the server too.

## Quick start

```svelte
<!-- src/routes/+layout.svelte: tokens first, then the component styles that read them -->
<script lang="ts">
  import "@chai-ui/tokens/css";
  import "@chai-ui/svelte/style.css";
  import { ChaiProvider } from "@chai-ui/svelte";

  let { children } = $props();
</script>

<ChaiProvider>{@render children()}</ChaiProvider>
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { Composer, ResultCard, createFalEngine, useComposer } from "@chai-ui/svelte";

  const composer = useComposer({ engine: createFalEngine() });
  let value = $state("");
  const busy = $derived(composer.run?.results.some((r) => r.status === "queued" || r.status === "running") ?? false);

  async function enhance(prompt: string) {
    value = await composer.enhance!(prompt);
  }
</script>

<Composer
  {value}
  onChange={(next) => (value = next)}
  onSubmit={composer.submit}
  submitting={busy}
  onAbort={composer.cancel}
  onEnhance={composer.enhance && enhance}
  enhancing={composer.enhancing}
/>
{#if composer.run}
  <ResultCard results={composer.run.results} prompt={composer.run.request.prompt} onAction={() => {}} />
{/if}
```

To try it before setting up a provider, leave out `engine` and
`ChaiProvider`: everything then runs on built-in mocks, with no network
calls and no keys.

## The Svelte names

The props are React's, unchanged: `value` and `onChange`, `attachments` and
`onAttachmentsChange`, `onSubmit`, `onAction`, `onEvent`. Only these differ:

| React | Svelte |
|---|---|
| `className`, and `style` as an object | `class`, and `style` as a string |
| `useComposer` / `useMediaAnalyzer` return values | They return an object whose fields stay current: read `composer.run`, don't destructure it |
| Options that change between renders | Pass a function: `useComposer(() => ({ engine, editImage }))` |
| `<EditCard {...edit} />` | The same: `{#if composer.edit}<EditCard {...composer.edit} />{/if}` |

Call `useComposer`, `useMediaAnalyzer` and `useReasoning` while a component
initializes (in its `<script>`), as with Svelte's own `getContext`.

Some controls show only when you pass their callback, as in React: the
optimize button with `onEnhance`, stop with `onAbort`, the Model menu with
`onModelChange`.

Docked the bar? Set `menuPlacement="above"` for a bar fixed to the bottom
of the screen, or `"below"` for one fixed to the top, so every menu opens
into the page. Left out, it's `"auto"`: each menu goes where it fits.

## What's in the package

- **`Composer`**: prompt, attachments, use cases, model and aspect-ratio
  menus with suggested models, prompt optimization, auto-select routing,
  stop and retry.
- **`MediaAnalyzer`** + **`useMediaAnalyzer`**: media in, a
  generation-ready prompt out.
- **`ResultCard`**: one prompt's results, paged, with votes, retry,
  download, share, details, streaming text and quality-check tags (from
  your backend, or the opt-in judge: `useComposer({ judgeModel, judgeChecks })`).
- **Analytics:** `onEvent` on `Composer` and `ResultCard` reports what the
  person does and sees, one `ChaiEvent` each, for any analytics tool:
  `onEvent={(e) => posthog.capture(e.name, e.properties)}`.
- **`EditCard`**: marked regions with their own instructions, and each
  edit as a new version.
- **`useComposer`**, **`ChaiProvider`**, and the `Toggle`, `SearchMenu`
  and `Pagination` building blocks.
- The engines and types from `@chai-ui/core`, re-exported.

## Your API keys stay on your server

The engines call one route on your server, which adds the key. In
SvelteKit 3, declare the keys, then add the route:

```ts
// src/env.ts: the keys the route reads. Each is optional: set the ones you use.
import { defineEnvVars } from "@sveltejs/kit/env";

const optional = (value: string | undefined) => value;
export const variables = defineEnvVars({
  FAL_KEY: { schema: optional },
  OPENROUTER_API_KEY: { schema: optional },
  AI_GATEWAY_API_KEY: { schema: optional },
});
```

```ts
// src/routes/api/chai/[...path]/+server.ts
import { AI_GATEWAY_API_KEY, FAL_KEY, OPENROUTER_API_KEY } from "$app/env/private";
import { createChaiHandler } from "@chai-ui/core/server";
import type { RequestHandler } from "./$types";

const chai = createChaiHandler({ falKey: FAL_KEY, openRouterKey: OPENROUTER_API_KEY, aiGatewayKey: AI_GATEWAY_API_KEY });
export const fallback: RequestHandler = ({ request }) => chai.handle(request);
```

On SvelteKit 2, skip `src/env.ts` and read the keys with
`import { env } from "$env/dynamic/private"` (`env.FAL_KEY`, and so on).

Then set `FAL_KEY`, `OPENROUTER_API_KEY` or `AI_GATEWAY_API_KEY` in your
server's environment (`.env` works in development). Other servers, and
`authorize` and `allowedModels` for production, are in the
[`@chai-ui/core` README](https://github.com/kazarazat/chai-ui/tree/main/packages/core#the-server-route-chai-uicoreserver).

## Without a server (desktop apps)

Tauri and Electron apps have no server route for the engines to call, and
their CSP usually limits `connect-src` to the app itself. Write your own
`GenerationEngine` that hands each run to your app's backend (a Tauri
command, or a local daemon), which holds the key and calls the model:

```ts
// src/lib/desktop-engine.ts: one run per call, through your app's backend.
import { invoke } from "@tauri-apps/api/core";
import type { GenerationEngine, MediaKind } from "@chai-ui/svelte";

export const desktopEngine: GenerationEngine = {
  async generate({ modelId, prompt, attachments, aspectRatio, signal }) {
    const result = await invoke<{ src: string; kind: MediaKind }>("chai_generate", {
      modelId, prompt, attachments, aspectRatio,
    });
    signal?.throwIfAborted();
    return result;
  },
};
```

Pass it as usual: `useComposer(() => ({ engine: desktopEngine }))`. The key
never reaches the webview, and nothing needs `connect-src` beyond the app.
For a local daemon, swap `invoke` for a `fetch` to its localhost address
and add that address to `connect-src`.
