---
"@chai-ui/core": patch
"@chai-ui/react": patch
---

The Composer's derived state (active use cases, model sections and picks, offered aspect ratios, submit rules, placeholder and submit payload) is now `composerView()` in `@chai-ui/core`, with `composerAttachMenuItems`, `composerAttachmentsFromFiles`, `regionColor` and the Enhance reveal timing alongside it. React's `Composer` uses them and behaves as before; picked files are now added in the order picked rather than the order they finish reading.
