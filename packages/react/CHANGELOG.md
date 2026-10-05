# @chai-ui/react

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
