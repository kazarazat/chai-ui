---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/svelte": minor
---

**Analytics for every component.** `MediaAnalyzer` and `EditCard` now take `onEvent` (`@event` in Vue), like the Composer, ResultCard and SidePanel, so every Chai component reports what the person does. The media analyzer reports media attached and removed, the model, auto-select and prompt length picks, submit (with retry), Stop, and each analysis finishing, done or with an error. The edit card reports regions added, confirmed and removed, zoom, paging through versions, and download and share; moving and resizing a region aren't reported, since every drag would send one. As before, nothing identifying is sent: no file names, file contents or instruction text, only kinds, counts and lengths. Core adds `mediaAnalyzerEvents` and `editCardEvents`.
