---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

Composer: no auto-select with `multiSelectUseCases`. Each use case's Model menu is picked by hand: the "Auto-select model" switch no longer shows in those menus, and a builder's `autoSelectModel` is ignored in that mode (the submit payload's `autoSelectModel` is `false`). Before, every menu showed a switch, but they all controlled one shared setting.
