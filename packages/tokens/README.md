# @chai-ui/tokens

The single source of truth for color, space, radius, type, and motion values
across CHAI UI. One JSON file in, three consumers out:

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
re-theme only touches the root palette.

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

[Tokens Studio for Figma]: https://tokens.studio/
