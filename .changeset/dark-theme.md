---
"@chai-ui/tokens": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/svelte": minor
---

**Dark theme.** Set `data-chai-theme="dark"` on `<html>`, or on any element, and every component inside it switches to dark surfaces with near-white text; without the attribute nothing changes. Every text pair meets WCAG 2.2 AA contrast, the brand green moves to `green-60` for legibility, menu and picker rows hover green, and the Material switch, submit button and text field follow the theme. The values live in `tokens.json`'s new `color.dark` group, using two new root grays (`gray-15`, `gray-20`). New semantic roles, the same as before in the light theme: `menu-item-hover`, `control-pill` (the action pills on text and audio results) and `dropzone-surface` / `dropzone-border` (the Media Analyzer's drop zone). A new role without a dark value now fails the token build. Also: the Composer's focus ring is drawn over its border rather than 2px outside it, so focus shows one green edge instead of a ring plus a border.
