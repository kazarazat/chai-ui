---
"@chai-ui/tokens": patch
---

`gradient.media-fade` is now built from `color.semantic.media-backdrop`, so setting `--chai-color-semantic-media-backdrop` on `:root` recolors the fade and the bar under paginated media together, with no seam. It looks the same with the default black. Override `--chai-gradient-media-fade` to replace the fade entirely.
