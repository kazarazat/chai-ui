# @chai-ui/core

## 0.11.4

### Patch Changes

- ca123be: Composer: no auto-select with `multiSelectUseCases`. Each use case's Model menu is picked by hand: the "Auto-select model" switch no longer shows in those menus, and a builder's `autoSelectModel` is ignored in that mode (the submit payload's `autoSelectModel` is `false`). Before, every menu showed a switch, but they all controlled one shared setting.

## 0.11.3

### Patch Changes

- d391437: Composer, multi-use-case select: a Model menu per use case, a model required in each, and only Image and Video combine.
  
  - Each picked use case gets its own Model menu ("Image model", "Video model") instead of one sectioned menu summarised as "2 models". Each picks one model unless `multiSelectModels` is also on.
  - Submit waits for a model in every use case, or auto-select. Before, picking only an image model let the video run on the engine's default model, which nobody chose.
  - Only Image and Video combine, since they're the only use cases that can share one prompt and one Enhance rewrite. **Music, Speech, World and Edit image now run alone**: if you combined Music with Image or Video, it now replaces them. New `nextUseCases(current, picked)` applies the rule to a `+` menu pick, and `combinesWithOthers(useCase)` says whether a use case can join others. A `useCases` list that breaks the rule runs only its last pick.

## 0.11.2

### Patch Changes

- 813ddcf: Composer: Create image keeps its Aspect ratio menu when an image is attached. The suggested edit models it switches to (Flux 3 Image, Nano Banana Pro, GPT Image 2) now list the aspect ratios Fal takes for them; the Edit image use case still keeps the image's shape and sends none. Veo 3.1 Fast's image-to-video lists its 16:9 and 9:16 crops; the other image-to-video models follow the image's shape, so Video with an attached image shows the menu only with Veo picked.

## 0.11.1

### Patch Changes

- e4de4cf: New `engineCallInputs(payload, selection)` in `@chai-ui/core`: the model, prompt and aspect ratio (and the voice, for speech) one engine call takes from a submit. The store builds its requests from it, so a builder can show the call the model receives and it matches what's sent. Music's genres are written into the prompt it returns.

## 0.11.0

### Minor Changes

- 789ba97: Create speech and Create music: two opt-in audio use cases in the Composer's attach menu, in their own group under a divider. Add `"create-speech"` / `"create-music"` to `attachMenuActions` and set `CREATE_SPEECH_USE_CASE` / `CREATE_MUSIC_USE_CASE` on the pick. `ComposerUseCase` takes `audio: "speech" | "music"`, and `GenerationUseCase` gains `"text-to-speech"` and `"text-to-music"`. Once a model is picked, Create speech shows a Voice menu from that model's `ModelOption.voices` (`speechVoice` / `onSpeechVoiceChange`, `v-model:speech-voice` in Vue), and Create music a multi-select Genre menu from the picked models' `ModelOption.genres` (`genres` / `onGenresChange`). The engine gets `voice`; genres are written into the prompt (`promptWithGenres`). `createFalEngine` takes `models` so your own models' `falInput` is used, and `falInput.prompt` sends the words as `text` for models whose schema asks for it. The attach menu's items are 40px tall (MD3 density -2), and its `+` button has a hover state. Menu search fields are 44px tall, down from Material's 56px, with a "Search" placeholder. `SearchMenu` rows use the controls' 14px label type and grey (they were 16px near-black), 40px tall, with a 16px multi-select checkbox; the auto-select switch label matches. New `menuPlacement` on `Composer` (`"auto" | "above" | "below"`, `menu-placement` in Vue) sets which way every menu in the bar opens: `"above"` for a bar docked to the bottom of the screen, `"below"` for one docked to the top. The default `"auto"` measures when a menu opens and goes below if it fits, else above if that fits, else toward the side with more room. `SearchMenu` takes the same `placement`, and core exports `menuOpensAbove`. The `+` menu used to always open upward, so it was cut off when the page scrolled. With `multiSelectUseCases`, each menu (Aspect ratio, Frame rate, Voice, Genre) reads only its own use case's models, so Image and Music picked together keep both menus. The tokens bridge sets Material's typeface (`--md-ref-typeface-plain` / `-brand`) to Chai's Material family, so Material text fields keep its fallbacks and never render in serif.
  
  **Breaking:** the attach menu's "Edit image" action is now `"edit-image"` (was `"edit-media"`). Update `attachMenuActions` and any `onAttachMenuSelect` check. `COMPOSER_ATTACH_MENU_ITEMS` items carry a `group` instead of `divider`; `composerAttachMenuItems` still returns `divider`, now worked out from the groups.

## 0.10.1

### Patch Changes

- 41aafd0: Package descriptions and READMEs use the name "Chai UI" throughout, and each README opens with the product name. Adds the `chai-ui` npm keyword. No code changes.

## 0.10.0

### Minor Changes

- 7b7180b: Vercel AI Gateway as a supported engine. `createVercelEngine()` runs text (streamed, with usage, like OpenRouter) and image generation through Vercel's AI Gateway. It has no video output, since the gateway has no video endpoint yet, so use Fal.ai for video. `pingVercel()` is the connection check. `createChaiHandler` gains a `vercel` route, keyed on `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN` on Vercel), and an `aiGatewayKey` option.

## 0.9.0

### Minor Changes

- 072f9b9: Composer: voice input. Add `voiceInput` and a mic appears left of submit: the person speaks, and the transcript is added to the prompt to check and edit, never sent on its own. While recording, a live waveform of the mic level stands in for the prompt and the mic becomes a stop button; while transcribing, a spinner (click to cancel). Submit is hidden until the transcript is in. Recordings stop and transcribe on their own at `maxSeconds` (default 60), and Escape discards one.
  
  - **Name a model:** `voiceInput={{ model: "fal-ai/wizper" }}` sends the clip through your existing `/api/chai/fal` route, so the key stays on the server. Any Fal speech-to-text model works (Wizper, ElevenLabs Scribe v2, Cohere Transcribe, Nemotron ASR, Fal Speech-to-Text). With `allowedModels` on the handler, list the model too.
  - **Or bring your own:** `voiceInput={{ transcribe }}`, a function that takes the clip and returns text, for any provider.
  
  There's no default model: no `voiceInput`, no mic. Clear inline messages cover a blocked microphone (in the browser or by the computer), no microphone, nothing heard, and a failed transcription. New in core: `createVoiceInput`, `createFalTranscriber`, `extractFalTranscript`, and the `Transcribe`, `VoiceClip` and `VoiceInputConfig` types.

### Patch Changes

- 072f9b9: Fix: Enhance now rewrites for the use case on screen. It used to guess from the last run, so on a fresh page, or right after switching use cases, a text request (no use case picked) was rewritten as an image prompt, adding things like "cinematic lighting, 8k". `onEnhance` now gets a third argument, `mode`: the active use case, derived the same way as a submit's (`"text-to-text"` with no use case picked, `"vision"` with media attached, `"image-edit"` while editing). `useComposer`'s `enhance` takes it, so `onEnhance={enhance}` rewrites correctly with no change on your side. A custom `onEnhance` can read `mode` to choose its own rewrite instruction.

## 0.8.0

### Minor Changes

- 7677e82: Composer: Create world, a use case for world models. Opt in by adding `"create-world"` to `attachMenuActions`; with the World chip on, the prompt becomes two fields, Environment (required) and Character (optional, `character` / `v-model:character`), each with its own Enhance button. `onEnhance` now gets the field (`"prompt"`, `"environment"` or `"character"`), and `useComposer`'s Enhance words its rewrite for that field. A frame rate menu (`frameRate` / `v-model:frame-rate`) offers the rates the selected models share (`ModelOption.frameRates`). Submits carry `character` and `frameRate`, which reach the engine's `generate()`; route worlds with `engineByKind.world`. No world models are suggested yet: none is hosted on Fal or OpenRouter. New types: `OutputKind`, `ComposerPromptField`.
  
  Tokens: `--chai-color-semantic-control-field`, the fill of the world fields.

## 0.7.1

### Patch Changes

- c353951: Auto-select now belongs to the use case it was turned on for. When the end user owns the switch (`showAutoSelectToggle`), picking another use case turns auto-select off (`onAutoSelectModelChange(false)` in React, `update:autoSelectModel` in Vue), so the new use case's model is picked by hand instead of silently auto-selected. A builder's own `autoSelectModel`, with no switch shown, is left as set. Tokens: new `--chai-color-root-amber-30`, an amber dark enough for text on light surfaces.
- dbdd324: The Composer no longer picks a model for the person. With a Model menu shown, nothing is picked until they choose one: the trigger reads "Select model" and submit waits for a pick, or for auto-select to choose. This holds for every use case, edits included. With no Model menu (no `onModelChange`), a suggested list's first model still runs, since there's nothing to pick from.

## 0.7.0

### Minor Changes

- 1f0219b: New: `@chai-ui/vue`, the same components for Vue 3.5 or later (Nuxt included): `Composer`, `MediaAnalyzer`, `ResultCard`, `EditCard`, `ChaiProvider`, the `useComposer` and `useMediaAnalyzer` composables, and the `Toggle`, `SearchMenu` and `Pagination` building blocks. It uses `v-model` for every controlled value and events for the rest, and runs the same browser test suite as `@chai-ui/react`, including the WCAG 2.2 AA checks. `DESIGN.md` now covers both packages.

### Patch Changes

- 338dc24: The Composer's derived state (active use cases, model sections and picks, offered aspect ratios, submit rules, placeholder and submit payload) is now `composerView()` in `@chai-ui/core`, with `composerAttachMenuItems`, `composerAttachmentsFromFiles`, `regionColor` and the Enhance reveal timing alongside it. React's `Composer` uses them and behaves as before; picked files are now added in the order picked rather than the order they finish reading.
- f785993: EditCard's geometry (fitting, moving and resizing region boxes, zoom and pan, the instruction field's placement and the card's width) now lives in `@chai-ui/core`, with `regionColor` alongside the other region helpers. React's `EditCard` uses it and behaves as before.
- 0dc5c92: MediaAnalyzer's attachment rules and file reading (`nextMediaAnalyzerAttachments`, `isMediaAnalyzerAtCap`, `DEFAULT_MAX_ATTACHMENTS_BY_KIND`, `readMediaFiles`, `replacedNote`, `mediaAnalyzerModelSections`) now live in `@chai-ui/core`; `@chai-ui/react` still exports the first three. No change to how the React component behaves.
- ead952e: ResultCard's download, share and formatting helpers (`downloadMedia`, `shareMedia`, `downloadFilename`, `formatDuration`, `formatCost`, `formatTokens`, `formatAspectRatio`, `resultModelLabel`) now live in `@chai-ui/core`, so every framework binding shows results the same way. No change to how the React components behave.

## 0.6.1

### Patch Changes

- eecad9a: The Composer's and Media Analyzer's behavior now lives in `@chai-ui/core` as framework-free stores (`createComposerStore`, `createMediaAnalyzerStore`), along with the reasoning helpers and the shared Composer types. `useComposer`, `useMediaAnalyzer` and `ChaiProvider` wrap them and work exactly as before. This is groundwork for the Vue package.

## 0.6.0

### Minor Changes

- a770467: Suggested model lists, so builders don't have to write any. New in core: `SUGGESTED_IMAGE_MODELS`, `SUGGESTED_TEXT_TO_VIDEO_MODELS`, `SUGGESTED_IMAGE_TO_VIDEO_MODELS`, `SUGGESTED_EDIT_MODELS` (Fal) and `SUGGESTED_ANALYSIS_MODELS` (OpenRouter, per media kind), plus `suggestedModels(useCase)`, each model checked against its provider's catalog with its aspect ratios. `Composer` uses them when no `models` is passed, with the first model picked until the person picks another; `MediaAnalyzer`'s `models` and `modelsByKind` are now optional, defaulting to the analysis lists. Passing your own list still replaces them. Following 0.5.0's "no control that does nothing" rule, the Model menu now shows only with `onModelChange` (or `onModelIdsChange` for multi-select) and the Aspect ratio menu only with `onAspectRatioChange`; without them the default pick still runs. New `ModelOption.falInput` says how a Fal model takes its image and aspect ratio, and the Fal engine now sends each suggested model exactly that, which fixes image-to-video on Kling (`start_image_url`) and the Nano Banana Pro and GPT Image 2 edits (`image_urls`). New `checkSuggestedModels()` checks the lists against Fal and OpenRouter as they are today, with no key and no model run, for builders to run while setting up their engine.

## 0.5.0

No changes in this release.

## 0.4.0

### Minor Changes

- 603e2a6: Aspect ratios now come from the models and reach them. `ModelOption` gains `aspectRatios` (e.g. `["1:1", "16:9", "9:16"]`), and `Composer`'s Aspect ratio menu offers only ratios the selected models share (with none picked, or auto-select on, ratios every listed model takes), so a person can't pick one the model will reject. A model without `aspectRatios` sets its own shape and shows no menu, and a ratio the models don't take is never submitted. The `aspectRatios` prop is now optional, for your own labels or a shorter list. Before this release the picked ratio never reached the model: `useComposer` now passes it to the engine (`aspectRatio` in `generate`'s arguments), and the Fal engine sends it as each model expects (`aspect_ratio`; `image_size` for FLUX and GPT Image). If you passed `aspectRatios` to `Composer`, add `aspectRatios` to your models, or the menu stays hidden.

## 0.3.1

No changes in this release.

## 0.3.0

### Patch Changes

- 39432e5: Paginated cards put the page dots in their own bottom row. On `ResultCard` with several results, the row also names the model that made the page showing, and under an image or video the media fades into a dark bar so the label and dots read on any picture. `EditCard`'s version dots move to the same row. `Pagination` is now one slider instead of a button per dot (click picks the nearest dot; arrow keys, Home and End move), so the dots sit 16px apart while still meeting WCAG 2.2's 24px target size. Tests that clicked a dot button by name should click or key the `slider` role instead. New tokens: `gray-80`, `on-media-fade` and the `media-fade` gradient. `ModelOption.label` is documented as a short name with no parentheses. On narrow phones, `SearchMenu`'s panel shifts and shrinks to stay on screen, and the attachment remove buttons in `Composer` and `MediaAnalyzer` always show on touch screens, which can't hover.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- f082cfb: Image editing with marked regions. New `EditCard` component: mark regions on an image, give each its own instruction, zoom and pan, and page through each edit as a new version. `Composer` gets an edit mode (`EDIT_IMAGE_USE_CASE`) with colored region chips, and an edit can be submitted with only regions. `useComposer` takes an `editImage` and returns `edit` for the card. `@chai-ui/core` adds `buildRegionEditPrompt` and `PRECISE_EDIT_MODELS` (Flux 3 Image on Fal); the Fal engine sends `image_urls` to models that take a list. `@chai-ui/tokens` adds six region colors.
  
  `ResultCard` is now full bleed: the media fills the card, with like/dislike/retry/more, details and the page dots floating over its bottom, and download/share/expand on a dark backing at the top. The edit card shares the same floating controls. Paging in both cards slides between pages (skipped for reduced motion).
  
  Also: while auto-select chooses a model, the result card now shows progress right away ("Choosing model…") instead of the previous result. `Pagination` takes an optional `itemLabel`.
