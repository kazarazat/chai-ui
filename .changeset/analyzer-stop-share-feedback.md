---
"@chai-ui/react": minor
---

`MediaAnalyzer` gets a stop button: new `onAbort` (wire it to `useMediaAnalyzer`'s `cancel`) turns submit into stop while analyzing, like `Composer`. When an attach replaces what's there (one kind per analysis, or video and audio's single slot), it now says so: "Replaced 2 images with clip.wav." `ResultCard` and `EditCard` confirm Share with a check and "Link copied" when there's no share sheet and the link was copied instead. `shareMedia` now reports `"shared"`, `"copied"` or `"none"`.
