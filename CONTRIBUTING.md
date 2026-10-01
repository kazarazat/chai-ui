# Contributing to Chai UI

Thanks for helping. Bug reports, fixes and docs improvements are all
welcome. For a new component or a larger change, open an issue first so we
can agree on the shape before you build it.

## Setup

You need Node 20+ and pnpm 10.

```sh
pnpm install
pnpm build
```

## Checks

Run these before opening a pull request; CI runs the same ones on React
18.3 and 19.

```sh
pnpm lint        # design-token rules and the rules of React
pnpm typecheck
pnpm test        # unit tests, then real-browser component and accessibility tests
pnpm pack-test   # installs the packed packages into a sample app and builds it
```

The browser tests need Chromium once:
`pnpm --filter @chai-ui/react exec playwright install chromium`.

## House rules

- **Colors come only from `@chai-ui/tokens`.** No hex values in component
  CSS; `pnpm lint` enforces it. A new color means a new token.
- **Components are controlled.** Values come in as props and changes go
  out as callbacks.
- **Follow the rules of React.** The React Compiler lint rules are on.
- **Keep accessibility green.** New UI needs a name for every control,
  keyboard operation, and 24px targets; the axe tests check WCAG 2.2 AA.
- **Never put API keys in browser code.** Engines call the server route.
- **Tests make no real model calls.** Inject a fake `fetchImpl` or engine.

## Changesets

If your change affects a published package, add a changeset:

```sh
pnpm changeset
```

Pick the bump (patch, minor or major) and write one line for the
changelog. The three packages share one version.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
