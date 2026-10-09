---
"@chai-ui/core": patch
"@chai-ui/react": patch
---

EditCard's geometry (fitting, moving and resizing region boxes, zoom and pan, the instruction field's placement and the card's width) now lives in `@chai-ui/core`, with `regionColor` alongside the other region helpers. React's `EditCard` uses it and behaves as before.
