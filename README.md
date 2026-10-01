<p align="center">
  <a href="https://chai-ui.com"><img src=".github/social-preview.png" alt="Chai UI" width="640" /></a>
</p>

<p align="center">
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://www.npmjs.com/package/@chai-ui/react"><img src="https://img.shields.io/npm/v/@chai-ui/react?label=npm" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
</p>

# Chai UI

Drop-in React components for generative-AI apps: a prompt composer, a
media analyzer, and result cards, wired to real AI engines and styled with
your tokens.

- **Composer:** a prompt bar with attachments, use cases, model and
  aspect-ratio menus, prompt optimization, auto-select model routing, and
  a stop button.
- **MediaAnalyzer:** drop in an image, video or audio clip and get a
  generation-ready prompt back.
- **ResultCard:** one prompt's results (image, video, audio or text), with
  like, retry, download, share, a details flip, and streaming text.
- **Engines:** Fal.ai for media generation, OpenRouter for reasoning, or
  your own. API keys stay on your server.

Docs and live examples: **[chai-ui.com/docs](https://chai-ui.com/docs)**

## Install

```sh
pnpm add @chai-ui/react @chai-ui/core @chai-ui/tokens
```

React 18.3 and 19 are supported.

## Quick start

```tsx
import "@chai-ui/tokens/css";
import "@chai-ui/react/style.css";
import { useState } from "react";
import { ChaiProvider, Composer, ResultCard, createFalEngine, useComposer } from "@chai-ui/react";

const engine = createFalEngine();

function App() {
  const [value, setValue] = useState("");
  const { run, submit, cancel } = useComposer({ engine });
  const busy = run?.results.some((r) => r.status === "queued" || r.status === "running") ?? false;

  return (
    <>
      <Composer value={value} onChange={setValue} onSubmit={submit} submitting={busy} onAbort={cancel} />
      {run && <ResultCard results={run.results} prompt={run.request.prompt} onAction={() => {}} />}
    </>
  );
}

export default function Root() {
  return (
    <ChaiProvider>
      <App />
    </ChaiProvider>
  );
}
```

To try it before setting up a provider, leave out `engine` and
`ChaiProvider`: everything then runs on built-in mocks, with no network
calls and no keys.

## Your API keys stay on your server

The engines call one route on your server, which adds the key. In Next.js
it's one file:

```ts
// app/api/chai/[...path]/route.ts
import { createChaiHandler } from "@chai-ui/core/server";

export const { GET, POST, PUT } = createChaiHandler();
```

Then set `FAL_KEY` and `OPENROUTER_API_KEY` on your server. Remix, React
Router, SvelteKit, Hono, Cloudflare Workers, Bun, Deno and Express are
covered in the [`@chai-ui/core` README](./packages/core/README.md#the-server-route-chai-uicoreserver),
along with `authorize` and `allowedModels` for production.

## Packages

| Package | What it is |
|---|---|
| [`@chai-ui/react`](./packages/react) | The components and hooks |
| [`@chai-ui/core`](./packages/core) | Framework-free data model, engines and the server route |
| [`@chai-ui/tokens`](./packages/tokens) | Design tokens as CSS variables, JS and a Figma token set |

## Accessibility

Chai's components are built to support WCAG 2.2 AA, tested with axe and
automated keyboard and focus checks in a real browser. See
[DESIGN.md](./packages/react/DESIGN.md#6-accessibility).

## Help and contributing

- Questions and troubleshooting: [SUPPORT.md](./SUPPORT.md)
- Bugs and ideas: [open an issue](https://github.com/kazarazat/chai-ui/issues/new/choose)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security: [SECURITY.md](./SECURITY.md)

## License

[MIT](./LICENSE) © kazarazat

Illustrations © 2026 Imani Razat, used with permission. They aren't
covered by the MIT license.
