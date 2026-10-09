---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

The Composer no longer picks a model for the person. With a Model menu shown, nothing is picked until they choose one: the trigger reads "Select model" and submit waits for a pick, or for auto-select to choose. This holds for every use case, edits included. With no Model menu (no `onModelChange`), a suggested list's first model still runs, since there's nothing to pick from.
