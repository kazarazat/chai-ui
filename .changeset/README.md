# Changesets

Every change to a published package (`@chai-ui/tokens`, `@chai-ui/core`,
`@chai-ui/react`) comes with a changeset: run `pnpm changeset`, pick the
bump (patch, minor or major) and write one line for the changelog.

The three packages are versioned together (`fixed` in `config.json`), so
they always share one version number and a builder never has to match
versions by hand.

Releasing:

1. `pnpm version-packages` — applies every pending changeset: bumps the
   versions and writes each package's `CHANGELOG.md`. Commit the result.
2. `pnpm release` — builds, tests and lints, then publishes the three
   packages to npm with `pnpm publish` (which swaps `workspace:*` for the
   real version numbers).
