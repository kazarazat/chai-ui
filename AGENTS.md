<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Chai UI: notes for AI coding agents

Chai UI is the front-end surface of AI apps: components for prompting,
analyzing media, showing results and editing images. It's published to npm
as four packages that share one version:

- `packages/tokens` (`@chai-ui/tokens`): design tokens. `src/tokens.json` is
  the only source; `build.mjs` emits CSS variables, JS/TS and a Figma set.
- `packages/core` (`@chai-ui/core`): everything framework-free. The data
  model (`run.ts`), the stores and the components' derived state
  (`composer.ts`, `composer-view.ts`, `edit-card.ts`, `media-analyzer.ts`),
  engines (`engines/fal.ts`, `engines/openrouter.ts`, `engines/vercel.ts`),
  model routing, suggested models, prompts (media analysis, the evaluation
  judge), and the server route (`src/server`, exported as
  `@chai-ui/core/server`, server-only).
- `packages/react` (`@chai-ui/react`, React 18.3 and 19) and
  `packages/vue` (`@chai-ui/vue`, Vue 3.5): thin bindings with the same
  components (`Composer`, `MediaAnalyzer`, `ResultCard`, `EditCard`),
  `ChaiProvider`, `useComposer`, `useMediaAnalyzer` and the primitives.
- `packages/svelte` (`@chai-ui/svelte`, Svelte 5): the third binding, in
  progress and `private` until its components are done. Same prop and hook
  names as React. Built with `svelte-package`, which ships the `.svelte`
  files for the app's own compiler. The hooks use runes
  (`useComposer.svelte.ts`) and return objects with getters, so they're read
  as `composer.run`.

## Commands

```sh
pnpm install
pnpm build        # turbo: tokens -> core -> react, vue and svelte
pnpm lint         # token rules + the rules of React (eslint-plugin-react-hooks)
pnpm typecheck
pnpm test         # unit tests, then real-browser component + axe tests, for every binding
pnpm pack-test    # packs, installs into sandbox/consumer-app with npm, builds it
pnpm check-docs   # after build: docs name real paths and exports (scripts/check-docs.mjs)
```

When you add a source file, an export or a feature, update the docs that
describe it in the same change (`pnpm check-docs` catches the mechanical
part; reread the wording yourself).

Browser tests need Chromium once:
`pnpm --filter @chai-ui/react exec playwright install chromium`.

## How the bindings stay identical

- **Behavior goes in core first.** A component's logic and derived state
  belong in `@chai-ui/core`; React, Vue and Svelte only render it and wire
  events.
- **One test suite for all.** Component behavior is tested once, as
  contracts in `packages/react/src/__tests__/contracts/`, which every
  binding runs. A change to behavior needs a contract test.
- **One stylesheet and one `DESIGN.md`.** Both live in `packages/react`
  and are copied into the Vue and Svelte packages at build. Edit only
  React's copies.

## Rules

- **Front end only.** Chai covers what the person sees and does. Model
  calls, latency, cost and storage belong to the builder's back end.
- **Colors come only from tokens.** No color literals in component CSS; a
  new color is a new token in `tokens.json`. `pnpm lint` enforces it.
- **Components are controlled.** Values in as props, changes out as
  callbacks. A callback's presence is the opt-in for its control (e.g. no
  `onEnhance`, no optimize button).
- **Follow the rules of React.** The React Compiler lint rules are on and
  must stay clean: no reading or writing refs during render, no setState in
  effects for derived state (use `useLatest` for latest-value refs).
- **Accessibility: support WCAG 2.2 AA.** Every control has an accessible
  name, works by keyboard, and has a 24×24px target. Add new states to the
  component's "passes axe" contract test (`wcagViolations`, in
  `packages/react/src/__tests__/axe.ts`); axe must stay at zero findings.
  Don't claim compliance in docs: Chai "supports" WCAG 2.2 AA, tested with
  automated checks.
- **No real model calls in tests.** Inject a fake engine or `fetchImpl`.
  Call `fetch` through a wrapper, never as `obj.fetchImpl(...)`: browsers
  throw "Illegal invocation".
- **API keys never reach the browser.** Engines call `/api/chai/*`, served
  by `createChaiHandler`, which reads `FAL_KEY` / `OPENROUTER_API_KEY` /
  `AI_GATEWAY_API_KEY`.
- **Defaults are suggestions.** Ship working defaults (e.g. the reasoning
  models in `ChaiProvider`, the suggested model lists) and document how to
  swap them; never require a builder to pick before anything works.
- **Opt-in features that call a model have no default model.** Voice input
  and the evaluation judge run only once the builder names the model.
- **Plain language in docs and messages.** Builders range from beginner to
  intermediate.
- **Changesets.** A change to a published package needs `pnpm changeset`:
  `patch` for fixes, `minor` for new options or features. Merging the
  "Version Packages" PR publishes to npm (trusted publishing,
  `release.yml`).
- **This repo is public.** Keep comments self-contained: no references to
  private documents, internal decisions or people.

## Related

The docs site (chai-ui.com/docs) lives in a separate repository and uses
these packages as a consumer. It must never be the place a package fix
lands.
