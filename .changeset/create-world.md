---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/tokens": minor
---

Composer: Create world, a use case for world models. Opt in by adding `"create-world"` to `attachMenuActions`; with the World chip on, the prompt becomes two fields, Environment (required) and Character (optional, `character` / `v-model:character`), each with its own Enhance button. `onEnhance` now gets the field (`"prompt"`, `"environment"` or `"character"`), and `useComposer`'s Enhance words its rewrite for that field. A frame rate menu (`frameRate` / `v-model:frame-rate`) offers the rates the selected models share (`ModelOption.frameRates`). Submits carry `character` and `frameRate`, which reach the engine's `generate()`; route worlds with `engineByKind.world`. No world models are suggested yet: none is hosted on Fal or OpenRouter. New types: `OutputKind`, `ComposerPromptField`.

Tokens: `--chai-color-semantic-control-field`, the fill of the world fields.
