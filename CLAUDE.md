# Chai UI: notes for AI coding agents

Chai UI is a set of React components for generative-AI apps, published to
npm as three packages that share one version:

- `packages/tokens` (`@chai-ui/tokens`): design tokens. `src/tokens.json` is
  the only source; `build.mjs` emits CSS variables, JS/TS and a Figma set.
- `packages/core` (`@chai-ui/core`): framework-free data model (`run.ts`),
  engines (`engines/fal.ts`, `engines/openrouter.ts`), model routing,
  media-analysis prompts, and the server route (`src/server`, exported as
  `@chai-ui/core/server`, server-only).
- `packages/react` (`@chai-ui/react`): `Composer`, `MediaAnalyzer`,
  `ResultCard`, `ChaiProvider`, the hooks (`useComposer`,
  `useMediaAnalyzer`) and primitives. `DESIGN.md` ships in the package and
  is the usage guide for builders and their agents.

The components are React-only (React 18.3 and 19).

## Commands

```sh
pnpm install
pnpm build        # turbo: tokens -> core -> react
pnpm lint         # token rules + the rules of React (eslint-plugin-react-hooks)
pnpm typecheck
pnpm test         # unit tests, then real-browser component + axe tests
pnpm pack-test    # packs, installs into sandbox/consumer-app with npm, builds it
```

Browser tests need Chromium once:
`pnpm --filter @chai-ui/react exec playwright install chromium`.

## Rules

- **Colors come only from tokens.** No color literals in component CSS; a
  new color is a new token in `tokens.json`. `pnpm lint` enforces it.
- **Components are controlled.** Values in as props, changes out as
  callbacks. A callback's presence is the opt-in for its control (e.g. no
  `onEnhance`, no optimize button).
- **Follow the rules of React.** The React Compiler lint rules are on and
  must stay clean: no reading or writing refs during render, no setState in
  effects for derived state (use `useLatest` for latest-value refs).
- **Accessibility: support WCAG 2.2 AA.** Every control has an accessible
  name, works by keyboard, and has a 24×24px target. Add new states to
  `src/__tests__/a11y.browser.test.tsx`; axe must stay at zero findings.
  Don't claim compliance in docs: Chai "supports" WCAG 2.2 AA, tested with
  automated checks.
- **No real model calls in tests.** Inject a fake engine or `fetchImpl`.
  Call `fetch` through a wrapper, never as `obj.fetchImpl(...)`: browsers
  throw "Illegal invocation".
- **API keys never reach the browser.** Engines call `/api/chai/*`, served
  by `createChaiHandler`, which reads `FAL_KEY` / `OPENROUTER_API_KEY`.
- **Defaults are suggestions.** Ship working defaults (e.g. the reasoning
  models in `ChaiProvider`) and document how to swap them; never require a
  builder to pick before anything works.
- **Plain language in docs and messages.** Builders range from beginner to
  intermediate.
- **Changesets.** A change to a published package needs `pnpm changeset`.
  Merging the "Version Packages" PR publishes to npm (trusted publishing,
  `release.yml`).
- **This repo is public.** Keep comments self-contained: no references to
  private documents, internal decisions or people.

## Related

The docs site (chai-ui.com/docs) lives in a separate repository and uses
these packages as a consumer. It must never be the place a package fix
lands.
