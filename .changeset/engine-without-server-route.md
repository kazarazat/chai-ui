---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/svelte": patch
---

READMEs: "Without a server route" for desktop apps (Tauri, Electron). The core README has the full pattern: a custom engine that forwards every run to your app's backend, the same engine as `ChaiProvider`'s `reasoningEngine`, your own `Transcribe` for voice input, and what Stop does. The React, Vue and Svelte READMEs link to it. Based on #79 by @iksnae.
