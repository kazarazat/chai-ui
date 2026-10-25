---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

ResultCard: fix the flip in Safari (WebKit). Flipping to the info side showed the front through, mirrored, and on a card with several results the info chips also showed below it. The turned-away face is now faded out when the card is edge-on, in every browser. Focus still moves to the info side's close button and back to Show details.
