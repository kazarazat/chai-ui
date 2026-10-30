---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/svelte": minor
---

**Side panel.** `SidePanel` is a panel on the left or right of your page with a Composer and its answers, for quick questions about the page or anything else. It opens from a launcher (or your own button with `open`), starts with a greeting, the Composer and optional prompt tips, then docks the Composer under the conversation. Answers stream from your reasoning engine as plain text with like, dislike, retry and copy, or in a full ResultCard (`answers="card"`); follow-ups carry the recent turns. Page context is opt-in (`pageContext`): the page's title, URL, selected text and main text go with each question, shown as a "This page" chip the person can remove. Push or overlay layouts, either side, a full-screen sheet on narrow screens, New chat, and Close clears the conversation. Core adds `readPageContext`, `buildSidePanelPrompt` and `sidePanelEvents` (opened, closed, New chat, prompt tips by position, the page chip).

The Composer gains two options any app can use: `extraMenuItems`, your own items at the top of the `+` menu, and `contextChips`, removable chips for context sent with the prompt. A long placeholder now wraps to fit while the prompt is empty instead of being cut off at one line.
