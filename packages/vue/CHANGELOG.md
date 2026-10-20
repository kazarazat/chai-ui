# @chai-ui/vue

## 0.11.0

### Minor Changes

- 789ba97: Create speech and Create music: two opt-in audio use cases in the Composer's attach menu, in their own group under a divider. Add `"create-speech"` / `"create-music"` to `attachMenuActions` and set `CREATE_SPEECH_USE_CASE` / `CREATE_MUSIC_USE_CASE` on the pick. `ComposerUseCase` takes `audio: "speech" | "music"`, and `GenerationUseCase` gains `"text-to-speech"` and `"text-to-music"`. Once a model is picked, Create speech shows a Voice menu from that model's `ModelOption.voices` (`speechVoice` / `onSpeechVoiceChange`, `v-model:speech-voice` in Vue), and Create music a multi-select Genre menu from the picked models' `ModelOption.genres` (`genres` / `onGenresChange`). The engine gets `voice`; genres are written into the prompt (`promptWithGenres`). `createFalEngine` takes `models` so your own models' `falInput` is used, and `falInput.prompt` sends the words as `text` for models whose schema asks for it. The attach menu's items are 40px tall (MD3 density -2), and its `+` button has a hover state. Menu search fields are 44px tall, down from Material's 56px, with a "Search" placeholder. `SearchMenu` rows use the controls' 14px label type and grey (they were 16px near-black), 40px tall, with a 16px multi-select checkbox; the auto-select switch label matches. New `menuPlacement` on `Composer` (`"auto" | "above" | "below"`, `menu-placement` in Vue) sets which way every menu in the bar opens: `"above"` for a bar docked to the bottom of the screen, `"below"` for one docked to the top. The default `"auto"` measures when a menu opens and goes below if it fits, else above if that fits, else toward the side with more room. `SearchMenu` takes the same `placement`, and core exports `menuOpensAbove`. The `+` menu used to always open upward, so it was cut off when the page scrolled. With `multiSelectUseCases`, each menu (Aspect ratio, Frame rate, Voice, Genre) reads only its own use case's models, so Image and Music picked together keep both menus. The tokens bridge sets Material's typeface (`--md-ref-typeface-plain` / `-brand`) to Chai's Material family, so Material text fields keep its fallbacks and never render in serif.
  
  **Breaking:** the attach menu's "Edit image" action is now `"edit-image"` (was `"edit-media"`). Update `attachMenuActions` and any `onAttachMenuSelect` check. `COMPOSER_ATTACH_MENU_ITEMS` items carry a `group` instead of `divider`; `composerAttachMenuItems` still returns `divider`, now worked out from the groups.

### Patch Changes

- Updated dependencies [789ba97]
  - @chai-ui/core@0.11.0
  - @chai-ui/tokens@0.11.0

## 0.10.1

### Patch Changes

- 41aafd0: Package descriptions and READMEs use the name "Chai UI" throughout, and each README opens with the product name. Adds the `chai-ui` npm keyword. No code changes.
- Updated dependencies [41aafd0]
  - @chai-ui/core@0.10.1
  - @chai-ui/tokens@0.10.1

## 0.10.0

### Patch Changes

- Updated dependencies [7b7180b]
  - @chai-ui/core@0.10.0
  - @chai-ui/tokens@0.10.0

## 0.9.0

### Minor Changes

- 072f9b9: Composer: voice input. Add `voiceInput` and a mic appears left of submit: the person speaks, and the transcript is added to the prompt to check and edit, never sent on its own. While recording, a live waveform of the mic level stands in for the prompt and the mic becomes a stop button; while transcribing, a spinner (click to cancel). Submit is hidden until the transcript is in. Recordings stop and transcribe on their own at `maxSeconds` (default 60), and Escape discards one.
  
  - **Name a model:** `voiceInput={{ model: "fal-ai/wizper" }}` sends the clip through your existing `/api/chai/fal` route, so the key stays on the server. Any Fal speech-to-text model works (Wizper, ElevenLabs Scribe v2, Cohere Transcribe, Nemotron ASR, Fal Speech-to-Text). With `allowedModels` on the handler, list the model too.
  - **Or bring your own:** `voiceInput={{ transcribe }}`, a function that takes the clip and returns text, for any provider.
  
  There's no default model: no `voiceInput`, no mic. Clear inline messages cover a blocked microphone (in the browser or by the computer), no microphone, nothing heard, and a failed transcription. New in core: `createVoiceInput`, `createFalTranscriber`, `extractFalTranscript`, and the `Transcribe`, `VoiceClip` and `VoiceInputConfig` types.

### Patch Changes

- 072f9b9: Fix: Enhance now rewrites for the use case on screen. It used to guess from the last run, so on a fresh page, or right after switching use cases, a text request (no use case picked) was rewritten as an image prompt, adding things like "cinematic lighting, 8k". `onEnhance` now gets a third argument, `mode`: the active use case, derived the same way as a submit's (`"text-to-text"` with no use case picked, `"vision"` with media attached, `"image-edit"` while editing). `useComposer`'s `enhance` takes it, so `onEnhance={enhance}` rewrites correctly with no change on your side. A custom `onEnhance` can read `mode` to choose its own rewrite instruction.
- Updated dependencies [072f9b9]
- Updated dependencies [072f9b9]
  - @chai-ui/core@0.9.0
  - @chai-ui/tokens@0.9.0

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
