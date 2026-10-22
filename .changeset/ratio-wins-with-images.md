---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/tokens": minor
---

Composer: attached images no longer change the model list or hide Aspect ratio, and the picked ratio always wins.

- Create image always offers its five suggested models, and Create video its four, with or without images attached. Before, an attached image swapped in the edit or image-to-video list, and Video's Aspect ratio menu disappeared for most models.
- New `ModelOption.withImages`: the Fal model to call instead when images are attached. Every suggested Create image and Create video model names its image-taking endpoint (an edit, or image-to-video), and the Fal engine calls it, sending the ratio wherever that endpoint takes one.
- Flux 3 Klein replaces FLUX.1 schnell in the suggested Create image models: FLUX.1 schnell has no Fal endpoint that takes a prompt and an image together, and Flux 3 Klein (also fast, from Black Forest Labs) has both. Pass `fal-ai/flux/schnell` in your own `models` to keep it.
- New `startImageFit` on `useComposer` / `createComposerStore`: how a video's start image meets the picked ratio, `"crop"` (the default, around the center) or `"pad"` (black bars). The image is fitted before it's sent, so the video comes out in the picked ratio even on image-to-video models that take the image's own shape.
