---
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/svelte": minor
"@chai-ui/tokens": minor
"@chai-ui/core": minor
---

**`style-without-fonts.css`**: the same component styles without Roboto, for apps with their own typography. Import `@chai-ui/react/style-without-fonts.css` (or the Vue or Svelte package's) in place of `style.css`, then set `--chai-type-family-material` to your font. `style.css` is unchanged and still loads Roboto, so nothing changes for existing apps.
