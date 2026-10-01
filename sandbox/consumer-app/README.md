# CHAI UI packaging smoke test

Not a demo. This app exists to answer one question honestly: **does
`@chai-ui/react` (and its `@chai-ui/core`/`@chai-ui/tokens` dependencies)
actually work when installed as a real package, the way an external
consumer would install them?**

Everywhere else in this monorepo, `@chai-ui/*` gets pulled in via pnpm's
workspace linking (`workspace:*`), which just
symlinks straight to source. That never exercises the actual
`package.json` — a wrong path in `exports`, a file missing from
`files: ["dist"]`, or a dependency only present because it's hoisted at
the monorepo root (but not declared in `peerDependencies`) would all work
fine under workspace linking and then break for a real external installer.

This directory is deliberately **not** a pnpm workspace member (see
`../../pnpm-workspace.yaml` — it only globs `packages/*`), so
its `@chai-ui/*` dependencies below install from real `pnpm pack` tarballs
instead.

## Usage

```sh
./scripts/pack-test.sh          # build, pack, install, and build this app
./scripts/pack-test.sh --dev    # ...then also boot this app's dev server
```

Run from the repo root. See that script for exactly what it does and why.

## Why `npm`, not `pnpm`, installs this app

pnpm still tries to fold a plain `pnpm install` run in this directory into
the *whole monorepo's* install, since it walks up and finds this repo's
`pnpm-workspace.yaml` regardless of the `packages:` glob — confirmed
empirically, it printed "Scope: all 5 workspace projects" and installed
nothing into this directory at all. `npm` has no notion of
`pnpm-workspace.yaml` and can't get confused by it, which also makes this
a more honest test — most real consumers of a published package aren't
using pnpm anyway.

## What not to hand-edit

`package.json`'s `@chai-ui/react` dependency and its `overrides` block
(forcing `@chai-ui/core`/`@chai-ui/tokens` to resolve from the same packed
tarballs, even though `@chai-ui/react`'s own manifest requests them by a
plain version number once packed) both get rewritten by `pack-test.sh`
every run. `node_modules/`, `.tarballs/`, `dist/`, and
`package-lock.json` are all gitignored — nothing generated here is meant
to be committed, only this app's own source.
