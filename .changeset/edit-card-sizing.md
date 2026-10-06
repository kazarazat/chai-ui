---
"@chai-ui/react": minor
---

`EditCard` sizing for real photos. By default the card now fills a 630 × 630 box, keeping the image's shape (a landscape photo is 630 wide, a portrait one 630 tall), instead of a fixed 421px width. New `maxWidth` and `maxHeight` set the box. New `scale` starts from the image's own width instead (`0.3` = 30%, so a 5000px photo starts at 1500px), and `width` is now an optional fixed starting width; both are then fitted inside the box. A tall image narrows to fit instead of running past the screen. Each version is measured on its own.
