---
"@chai-ui/react": minor
---

`EditCard` sizing for real photos. New `scale` sizes the card from the image's own width (`0.3` = 30%, so a 5000px photo starts at 1500px), and new `maxWidth` and `maxHeight` (both default 630) fit the card inside that box with the image's shape kept. A tall image narrows to fit instead of running past the screen. `width` (default 421) is the starting size without `scale`. Each version is measured on its own.
