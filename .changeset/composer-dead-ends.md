---
"@chai-ui/react": minor
---

No more controls that silently do nothing, and no stale picks. `Composer` hides the thumbnail × and "Add media" without `onAttachmentsChange`, hides the `+` menu's use-case items without `onAttachMenuSelect` (and the `+` button when nothing in it would work), and hides a chip's × with nothing to clear it. New `attachMenuActions` shows only the `+` items you list. A picked model that isn't in the current `models` list shows as unpicked and is never submitted. In edit mode, attaching an image replaces the one being edited (the picker takes one image), and `useComposer` gives each new image's original version its own id, so `EditCard` starts it clean with no half-drawn region from the last image.
