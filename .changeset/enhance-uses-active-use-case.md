---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
---

Fix: Enhance now rewrites for the use case on screen. It used to guess from the last run, so on a fresh page, or right after switching use cases, a text request (no use case picked) was rewritten as an image prompt, adding things like "cinematic lighting, 8k". `onEnhance` now gets a third argument, `mode`: the active use case, derived the same way as a submit's (`"text-to-text"` with no use case picked, `"vision"` with media attached, `"image-edit"` while editing). `useComposer`'s `enhance` takes it, so `onEnhance={enhance}` rewrites correctly with no change on your side. A custom `onEnhance` can read `mode` to choose its own rewrite instruction.
