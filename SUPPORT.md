# Help & Support

Answers to common questions about installing, using and troubleshooting
Chai UI. Can't find yours? [Open an issue](https://github.com/kazarazat/chai-ui/issues/new/choose).
Docs and live examples are at [chai-ui.com/docs](https://chai-ui.com/docs).

## Installation

**Which packages do I need?**
Three. For React: `pnpm add @chai-ui/react @chai-ui/core @chai-ui/tokens`.
For Vue: `pnpm add @chai-ui/vue @chai-ui/core @chai-ui/tokens`. For
Svelte: `pnpm add @chai-ui/svelte @chai-ui/core @chai-ui/tokens`. The
framework package has the components; the other two are its foundations.

**Which versions work?** React 18.3 and 19, Vue 3.5 or later (Nuxt
included), and Svelte 5.20 or later (SvelteKit included).

**The components render unstyled.** Import the CSS once, tokens first:
`import "@chai-ui/tokens/css";` then `import "@chai-ui/react/style.css";`
(or `@chai-ui/vue/style.css`, `@chai-ui/svelte/style.css`).

## Usage

**Do I need an API key to try it?** No. Without an engine and
`ChaiProvider`, everything runs on built-in mocks.

**How do I get real results?** Add the server route
(`createChaiHandler` from `@chai-ui/core/server`), set `FAL_KEY` and
`OPENROUTER_API_KEY` on your server, pass `createFalEngine()` to
`useComposer`, and wrap your app in `<ChaiProvider>`.

**Which providers are supported?** Fal.ai (recommended for image, video
and audio generation), OpenRouter (reasoning and a full alternative) and
Vercel AI Gateway (text and image models through one OpenAI-compatible
endpoint; no video yet).
Any other provider works through a custom engine: one `generate()` method.

**Can I change the reasoning models?** Yes. The defaults are Claude Opus 5
for text and images and Gemini 3.8 Flash for video and audio. Override them
with `ChaiProvider`'s `reasoningModel` and `reasoningModelByKind`, e.g.
`qwen/qwen3.8-omni-flash` for lower-cost video and audio.

**How do I restyle Chai?** Override the `--chai-color-semantic-*` CSS
variables on `:root`, or a component's own variables such as
`--chai-composer-bg`.

## Troubleshooting

**"FAL_KEY isn't set on the server" (or OPENROUTER_API_KEY, or AI_GATEWAY_API_KEY).** The route
can't find the key. Set it in the server's environment and restart the
server. On Cloudflare Workers, pass `falKey` / `openRouterKey` /
`aiGatewayKey` to `createChaiHandler` from `env`.

**Requests fail with 404.** The engines call `/api/chai/...`. Check the
route is mounted there, or pass `endpoint` to the engine.

**Requests fail with 403.** The handler's `authorize` rejected the request,
or the model isn't in `allowedModels`.

**I pressed stop but was still billed.** Cancellation is best effort. Fal
removes a request still in its queue; a running one may finish. OpenRouter
stops a streaming request for providers that support it (not Google).

**Auto-select always picks the first model.** Routing fell back: there's no
`ChaiProvider`, the reasoning call failed, or its reply named no listed
model. `onRoutingFallback` tells you which.
