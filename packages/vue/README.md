<p align="center">
  <a href="https://chai-ui.com"><img src="https://chai-ui.com/chai-wordmark.svg" alt="Chai UI" width="220" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chai-ui/vue"><img src="https://img.shields.io/npm/v/@chai-ui/vue?label=npm&color=009747" alt="npm version" /></a>
  <a href="https://github.com/kazarazat/chai-ui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://chai-ui.com/docs/"><img src="https://img.shields.io/badge/docs-chai--ui.com-009747" alt="Docs" /></a>
</p>

# @chai-ui/vue

Vue components for the input and output surfaces of generative-media
apps: a prompt composer, a media-to-prompt analyzer, a result card and an
edit card, with the AI work built in and wired to Fal.ai, OpenRouter or
your own engine. Everything is controlled: you own the state with
`v-model`, and the components render it.

These are the same components as [`@chai-ui/react`](https://www.npmjs.com/package/@chai-ui/react),
with the same behavior. Both packages are thin layers over
`@chai-ui/core` and run one shared test suite, including the WCAG 2.2 AA
checks (axe, keyboard and focus).

Building with it, or pointing a coding agent at it? Read
[`DESIGN.md`](./DESIGN.md) (shipped in the package) for the usage rules,
and the docs site's [`llms.txt`](https://chai-ui.com/docs/llms.txt) for
the API. The code boxes on [chai-ui.com/docs](https://chai-ui.com/docs)
switch between React and Vue.

## Install

```sh
pnpm add @chai-ui/vue @chai-ui/core @chai-ui/tokens
```

Vue 3.5 or later, Nuxt included. No Chai-specific build setup.

```ts
// main.ts: tokens first, then the component styles that read them
import "@chai-ui/tokens/css";
import "@chai-ui/vue/style.css";
```

## Quick start

```vue
<!-- App.vue -->
<template>
  <ChaiProvider><Create /></ChaiProvider>
</template>

<!-- Create.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { Composer, ResultCard, createFalEngine, useComposer } from "@chai-ui/vue";

const engine = createFalEngine();
const value = ref("");
const { run, submit, cancel, enhance, enhancing } = useComposer({ engine });
const busy = computed(() => run.value?.results.some((r) => r.status === "queued" || r.status === "running") ?? false);

async function onEnhance(prompt: string) {
  value.value = await enhance.value!(prompt);
}
</script>

<template>
  <Composer v-model="value" :submitting="busy" :enhancing="enhancing" @submit="submit" @abort="cancel" @enhance="onEnhance" />
  <ResultCard v-if="run" :results="run.results" :prompt="run.request.prompt" @action="() => {}" />
</template>
```

To try it before setting up a provider, leave out `engine` and
`ChaiProvider`: everything then runs on built-in mocks, with no network
calls and no keys.

## The Vue names

The props are React's, with Vue's conventions:

| React | Vue |
|---|---|
| `value` + `onChange` | `v-model` |
| `x` + `onXChange` | `v-model:x`, e.g. `v-model:attachments`, `v-model:model-id`, `v-model:regions` |
| `onSubmit`, `onAction`, `onEnhance`, `onAbort` | `@submit`, `@action`, `@enhance`, `@abort` |
| `useComposer` / `useMediaAnalyzer` hooks | composables returning refs; pass a getter for options that change |
| `<EditCard {...edit} />` | `edit`'s fields one by one, with `@update:active-version` and `@update:regions` |

Some controls show only with a listener, as in React: the optimize button
with `@enhance`, stop with `@abort`, the Model menu with `@update:model-id`.

## What's in the package

- **`Composer`**: prompt, attachments, use cases, model and aspect-ratio
  menus with suggested models, prompt optimization, auto-select routing,
  stop and retry.
- **`MediaAnalyzer`** + **`useMediaAnalyzer`**: media in, a
  generation-ready prompt out.
- **`ResultCard`**: one prompt's results, paged, with votes, retry,
  download, share, details and streaming text.
- **`EditCard`**: marked regions with their own instructions, and each
  edit as a new version.
- **`useComposer`**, **`ChaiProvider`**, and the `Toggle`, `SearchMenu`
  and `Pagination` building blocks.
- The engines and types from `@chai-ui/core`, re-exported.

## Your API keys stay on your server

The engines call one route on your server, which adds the key. In Nuxt:

```ts
// server/api/chai/[...path].ts
import { createChaiHandler } from "@chai-ui/core/server";

const chai = createChaiHandler();
export default defineEventHandler((event) => chai.handle(toWebRequest(event)));
```

Then set `FAL_KEY` and `OPENROUTER_API_KEY` on your server. Other servers,
and `authorize` and `allowedModels` for production, are in the
[`@chai-ui/core` README](https://github.com/kazarazat/chai-ui/tree/main/packages/core#the-server-route-chai-uicoreserver).
