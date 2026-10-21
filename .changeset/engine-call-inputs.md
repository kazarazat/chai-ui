---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

New `engineCallInputs(payload, selection)` in `@chai-ui/core`: the model, prompt and aspect ratio (and the voice, for speech) one engine call takes from a submit. The store builds its requests from it, so a builder can show the call the model receives and it matches what's sent. Music's genres are written into the prompt it returns.
