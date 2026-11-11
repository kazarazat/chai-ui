---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/svelte": minor
---

**Interactive response.** `InteractiveResponse` is an agent's reply with something to click or fill in, so a person can answer without typing: a call-to-action button, approve or decline (`confirm`), a form (text, long text, email, number, date or a dropdown), single or multiple choice with an optional "Other" field, choice cards with a description or an image, and a file request with a drop zone. Each element locks once answered and shows what the person did ("You clicked Cancel"); pass a saved `answer` to show it locked after a reload. `onAnswer` gives you the answer, and `interactiveAnswerText` turns it into the person's message. To let your model ask, offer it the `ask_user` tool from `interactiveResponseTool()` (OpenAI or Anthropic shape) and check its call with `parseInteractiveResponse`, which returns `null` for anything it can't draw. `onEvent` reports an element shown and answered, with kinds and counts only. Core adds `interactiveResponseEvents`, and `SearchMenu` takes a `triggerId` so a form label can name it.

**Aspect ratio menu.** The Composer's Aspect ratio menu is 160px wide, down from 280px, since ratios are short.
