# @chai-ui/core

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
