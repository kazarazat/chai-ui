# @chai-ui/core

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
