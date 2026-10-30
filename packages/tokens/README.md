<p align="center">
  <a href="https://chai-ui.com"><img src="https://chai-ui.com/chai-wordmark.svg" alt="Chai UI" width="220" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chai-ui/tokens"><img src="https://img.shields.io/npm/v/@chai-ui/tokens?label=npm&color=009747" alt="npm version" /></a>
  <a href="https://github.com/kazarazat/chai-ui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://chai-ui.com/docs/"><img src="https://img.shields.io/badge/docs-chai--ui.com-009747" alt="Docs" /></a>
</p>

# @chai-ui/tokens

The single source of truth for color, space, radius, type, and motion values
across Chai UI. One JSON file in, three consumers out:

```
src/tokens.json  →  dist/css/tokens.css        (CSS custom properties)
                 →  dist/js/index.js/.d.ts      (typed JS/TS exports)
                 →  dist/figma/tokens.figma.json (Figma token set)
```

## Editing tokens

Edit `src/tokens.json` only. It's a DTCG-flavored format: every leaf is
`{ "$value": ... }`, and a value can reference another token with
`{color.root.green-50}` — see `color.semantic.*` for examples of referencing
`color.root.*`. Always add new components against `color.semantic.*` (or add
a new semantic alias) rather than `color.root.*` directly, so a future
re-theme only touches the root palette. A new semantic role also needs its
dark theme value in `color.dark.*` (see below); the build fails without one.

Run `pnpm build` (from here, or `pnpm --filter @chai-ui/tokens build` from
the repo root) to regenerate `dist/`.

## Using the tokens

**CSS**

```css
@import "@chai-ui/tokens/css";

.my-thing {
  background: var(--chai-color-semantic-control-surface);
  padding: var(--chai-space-4);
}
```

**JS / TS**

```ts
import { tokens, flatTokens } from "@chai-ui/tokens";

tokens.color.semantic.accent; // "#009747"
flatTokens["color.semantic.accent"]; // same value, flat lookup
```

**Figma**

`dist/figma/tokens.figma.json` is shaped for the [Tokens Studio for Figma]
plugin (Import → JSON). It's also a reasonable starting point for a manual
Figma Variables import if you'd rather not add the plugin — the values are
already resolved, so no reference-following is required at the Figma end.

This is a design-tokens pipeline only: it does not keep Figma *components*
in sync with the code components.

## Dark theme

The dark theme is opt-in: set `data-chai-theme="dark"` on `<html>`, or on
any element, to switch every Chai component inside it. Without the
attribute nothing changes.

```html
<html data-chai-theme="dark">
```

Chai doesn't follow the system setting on its own, because your app decides
its theme. To follow it:

```ts
const dark = matchMedia("(prefers-color-scheme: dark)");
const sync = () =>
  dark.matches
    ? document.documentElement.setAttribute("data-chai-theme", "dark")
    : document.documentElement.removeAttribute("data-chai-theme");
sync();
dark.addEventListener("change", sync);
```

In `src/tokens.json`, `color.dark` holds what each semantic role becomes in
the dark theme, using the same root palette. The roles that sit on images
and video (the overlays, `media-backdrop` and the edit-region colors) look
the same in both themes. Every text pair in the dark theme meets WCAG 2.2 AA
contrast. The brand green moves to `green-60`, because `green-50` is too
dark for text on dark surfaces.

The build emits the dark values under `[data-chai-theme="dark"]` in
`@chai-ui/tokens/css`, along with the Material color roles again, so the switch,
submit button and text field follow the theme too. To adjust one role in
the dark theme only, override it under the same selector:

```css
[data-chai-theme="dark"] {
  --chai-color-semantic-control-surface: #202124;
}
```

[Tokens Studio for Figma]: https://tokens.studio/
