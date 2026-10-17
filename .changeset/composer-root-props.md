---
"@chai-ui/react": patch
---

Bug fix: React's `Composer` had no way to size the bar. It now takes `className` and `style` and applies them to its root element. Vue already passed both through to the root.
