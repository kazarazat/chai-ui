# @chai-ui/vue

## 0.8.0

### Minor Changes

- 7677e82: Composer: Create world, a use case for world models. Opt in by adding `"create-world"` to `attachMenuActions`; with the World chip on, the prompt becomes two fields, Environment (required) and Character (optional, `character` / `v-model:character`), each with its own Enhance button. `onEnhance` now gets the field (`"prompt"`, `"environment"` or `"character"`), and `useComposer`'s Enhance words its rewrite for that field. A frame rate menu (`frameRate` / `v-model:frame-rate`) offers the rates the selected models share (`ModelOption.frameRates`). Submits carry `character` and `frameRate`, which reach the engine's `generate()`; route worlds with `engineByKind.world`. No world models are suggested yet: none is hosted on Fal or OpenRouter. New types: `OutputKind`, `ComposerPromptField`.
  
  Tokens: `--chai-color-semantic-control-field`, the fill of the world fields.

### Patch Changes

- Updated dependencies [7677e82]
  - @chai-ui/core@0.8.0
  - @chai-ui/tokens@0.8.0

## 0.7.1

### Patch Changes

- c353951: Auto-select now belongs to the use case it was turned on for. When the end user owns the switch (`showAutoSelectToggle`), picking another use case turns auto-select off (`onAutoSelectModelChange(false)` in React, `update:autoSelectModel` in Vue), so the new use case's model is picked by hand instead of silently auto-selected. A builder's own `autoSelectModel`, with no switch shown, is left as set. Tokens: new `--chai-color-root-amber-30`, an amber dark enough for text on light surfaces.
- dbdd324: The Composer no longer picks a model for the person. With a Model menu shown, nothing is picked until they choose one: the trigger reads "Select model" and submit waits for a pick, or for auto-select to choose. This holds for every use case, edits included. With no Model menu (no `onModelChange`), a suggested list's first model still runs, since there's nothing to pick from.
- Updated dependencies [c353951]
- Updated dependencies [dbdd324]
  - @chai-ui/core@0.7.1
  - @chai-ui/tokens@0.7.1

## 0.7.0

### Minor Changes

- 1f0219b: New: `@chai-ui/vue`, the same components for Vue 3.5 or later (Nuxt included): `Composer`, `MediaAnalyzer`, `ResultCard`, `EditCard`, `ChaiProvider`, the `useComposer` and `useMediaAnalyzer` composables, and the `Toggle`, `SearchMenu` and `Pagination` building blocks. It uses `v-model` for every controlled value and events for the rest, and runs the same browser test suite as `@chai-ui/react`, including the WCAG 2.2 AA checks. `DESIGN.md` now covers both packages.

### Patch Changes

- Updated dependencies [338dc24]
- Updated dependencies [f785993]
- Updated dependencies [0dc5c92]
- Updated dependencies [ead952e]
- Updated dependencies [1f0219b]
  - @chai-ui/core@0.7.0
  - @chai-ui/tokens@0.7.0
