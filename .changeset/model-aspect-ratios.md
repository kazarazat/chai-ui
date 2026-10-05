---
"@chai-ui/core": minor
"@chai-ui/react": minor
---

Aspect ratios now come from the models and reach them. `ModelOption` gains `aspectRatios` (e.g. `["1:1", "16:9", "9:16"]`), and `Composer`'s Aspect ratio menu offers only ratios the selected models share (with none picked, or auto-select on, ratios every listed model takes), so a person can't pick one the model will reject. A model without `aspectRatios` sets its own shape and shows no menu, and a ratio the models don't take is never submitted. The `aspectRatios` prop is now optional, for your own labels or a shorter list. Before this release the picked ratio never reached the model: `useComposer` now passes it to the engine (`aspectRatio` in `generate`'s arguments), and the Fal engine sends it as each model expects (`aspect_ratio`; `image_size` for FLUX and GPT Image). If you passed `aspectRatios` to `Composer`, add `aspectRatios` to your models, or the menu stays hidden.
