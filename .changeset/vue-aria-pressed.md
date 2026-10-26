---
"@chai-ui/vue": patch
---

`ResultCard` in Vue: Download, Share, Expand, Retry and Show details no longer set `aria-pressed="false"`, which made screen readers announce them as toggle buttons that were off. Only Like and Dislike, the real toggles, say whether they're pressed, as in React and Svelte.
