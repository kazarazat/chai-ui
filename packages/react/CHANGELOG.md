# @chai-ui/react

## 0.6.0

### Minor Changes

- a8a5273: `MediaAnalyzer` gets a stop button: new `onAbort` (wire it to `useMediaAnalyzer`'s `cancel`) turns submit into stop while analyzing, like `Composer`. When an attach replaces what's there (one kind per analysis, or video and audio's single slot), it now says so: "Replaced 2 images with clip.wav." `ResultCard` and `EditCard` confirm Share with a check and "Link copied" when there's no share sheet and the link was copied instead. `shareMedia` now reports `"shared"`, `"copied"` or `"none"`.
- a770467: Suggested model lists, so builders don't have to write any. New in core: `SUGGESTED_IMAGE_MODELS`, `SUGGESTED_TEXT_TO_VIDEO_MODELS`, `SUGGESTED_IMAGE_TO_VIDEO_MODELS`, `SUGGESTED_EDIT_MODELS` (Fal) and `SUGGESTED_ANALYSIS_MODELS` (OpenRouter, per media kind), plus `suggestedModels(useCase)`, each model checked against its provider's catalog with its aspect ratios. `Composer` uses them when no `models` is passed, with the first model picked until the person picks another; `MediaAnalyzer`'s `models` and `modelsByKind` are now optional, defaulting to the analysis lists. Passing your own list still replaces them. Following 0.5.0's "no control that does nothing" rule, the Model menu now shows only with `onModelChange` (or `onModelIdsChange` for multi-select) and the Aspect ratio menu only with `onAspectRatioChange`; without them the default pick still runs. New `ModelOption.falInput` says how a Fal model takes its image and aspect ratio, and the Fal engine now sends each suggested model exactly that, which fixes image-to-video on Kling (`start_image_url`) and the Nano Banana Pro and GPT Image 2 edits (`image_urls`). New `checkSuggestedModels()` checks the lists against Fal and OpenRouter as they are today, with no key and no model run, for builders to run while setting up their engine.

### Patch Changes

- Updated dependencies [a770467]
  - @chai-ui/core@0.6.0
  - @chai-ui/tokens@0.6.0

## 0.5.0

### Minor Changes

- 7232185: No more controls that silently do nothing, and no stale picks. `Composer` hides the thumbnail × and "Add media" without `onAttachmentsChange`, hides the `+` menu's use-case items without `onAttachMenuSelect` (and the `+` button when nothing in it would work), and hides a chip's × with nothing to clear it. New `attachMenuActions` shows only the `+` items you list. A picked model that isn't in the current `models` list shows as unpicked and is never submitted. In edit mode, attaching an image replaces the one being edited (the picker takes one image), and `useComposer` gives each new image's original version its own id, so `EditCard` starts it clean with no half-drawn region from the last image.
- a3e45ec: `EditCard` sizing for real photos. By default the card now fills a 630 × 630 box, keeping the image's shape (a landscape photo is 630 wide, a portrait one 630 tall), instead of a fixed 421px width. New `maxWidth` and `maxHeight` set the box. New `scale` starts from the image's own width instead (`0.3` = 30%, so a 5000px photo starts at 1500px), and `width` is now an optional fixed starting width; both are then fitted inside the box. A tall image narrows to fit instead of running past the screen. Each version is measured on its own.

### Patch Changes

- @chai-ui/core@0.5.0
  - @chai-ui/tokens@0.5.0

## 0.4.0

### Minor Changes

- 603e2a6: Aspect ratios now come from the models and reach them. `ModelOption` gains `aspectRatios` (e.g. `["1:1", "16:9", "9:16"]`), and `Composer`'s Aspect ratio menu offers only ratios the selected models share (with none picked, or auto-select on, ratios every listed model takes), so a person can't pick one the model will reject. A model without `aspectRatios` sets its own shape and shows no menu, and a ratio the models don't take is never submitted. The `aspectRatios` prop is now optional, for your own labels or a shorter list. Before this release the picked ratio never reached the model: `useComposer` now passes it to the engine (`aspectRatio` in `generate`'s arguments), and the Fal engine sends it as each model expects (`aspect_ratio`; `image_size` for FLUX and GPT Image). If you passed `aspectRatios` to `Composer`, add `aspectRatios` to your models, or the menu stays hidden.

### Patch Changes

- Updated dependencies [603e2a6]
  - @chai-ui/core@0.4.0
  - @chai-ui/tokens@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [892c9e9]
- Updated dependencies [5b3d2a9]
  - @chai-ui/tokens@0.3.1
  - @chai-ui/core@0.3.1

## 0.3.0

### Minor Changes

- 39432e5: Paginated cards put the page dots in their own bottom row. On `ResultCard` with several results, the row also names the model that made the page showing, and under an image or video the media fades into a dark bar so the label and dots read on any picture. `EditCard`'s version dots move to the same row. `Pagination` is now one slider instead of a button per dot (click picks the nearest dot; arrow keys, Home and End move), so the dots sit 16px apart while still meeting WCAG 2.2's 24px target size. Tests that clicked a dot button by name should click or key the `slider` role instead. New tokens: `gray-80`, `on-media-fade` and the `media-fade` gradient. `ModelOption.label` is documented as a short name with no parentheses. On narrow phones, `SearchMenu`'s panel shifts and shrinks to stay on screen, and the attachment remove buttons in `Composer` and `MediaAnalyzer` always show on touch screens, which can't hover.

### Patch Changes

- Updated dependencies [39432e5]
  - @chai-ui/tokens@0.3.0
  - @chai-ui/core@0.3.0

## 0.2.1

### Patch Changes

- fd3250f: Fix the edit card's region instruction field, which lost its styles in 0.2.0 (it showed as plain text along the bottom of the card instead of floating by its region). A broken stylesheet comment hid the rule; the token lint now fails on unbalanced CSS comments.
- @chai-ui/core@0.2.1
  - @chai-ui/tokens@0.2.1

## 0.2.0

### Minor Changes

- f082cfb: Image editing with marked regions. New `EditCard` component: mark regions on an image, give each its own instruction, zoom and pan, and page through each edit as a new version. `Composer` gets an edit mode (`EDIT_IMAGE_USE_CASE`) with colored region chips, and an edit can be submitted with only regions. `useComposer` takes an `editImage` and returns `edit` for the card. `@chai-ui/core` adds `buildRegionEditPrompt` and `PRECISE_EDIT_MODELS` (Flux 3 Image on Fal); the Fal engine sends `image_urls` to models that take a list. `@chai-ui/tokens` adds six region colors.
  
  `ResultCard` is now full bleed: the media fills the card, with like/dislike/retry/more, details and the page dots floating over its bottom, and download/share/expand on a dark backing at the top. The edit card shares the same floating controls. Paging in both cards slides between pages (skipped for reduced motion).
  
  Also: while auto-select chooses a model, the result card now shows progress right away ("Choosing model…") instead of the previous result. `Pagination` takes an optional `itemLabel`.

### Patch Changes

- 235ca6e: `ResultCard`'s loading spinner has `role="img"`, so its "Queued"/"Running" label is announced and passes axe.
- Updated dependencies [f082cfb]
  - @chai-ui/core@0.2.0
  - @chai-ui/tokens@0.2.0
