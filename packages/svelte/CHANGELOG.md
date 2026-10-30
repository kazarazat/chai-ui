# @chai-ui/svelte

## 1.4.1

### Patch Changes

- 94aa60e: **Submit needs a prompt.** The Composer let a person submit with only an attachment and no prompt, sending the model an empty prompt: an image model then errored or made something unrelated, since media alone doesn't say what to make. Submit now stays off until there's a prompt, for every use case. In edit mode a region still counts on its own, since each region carries its own instruction. The side panel's Composer follows the same rule.
- Updated dependencies [94aa60e]
  - @chai-ui/core@1.4.1
  - @chai-ui/tokens@1.4.1

## 1.4.0

### Minor Changes

- a317db4: **Analytics for every component.** `MediaAnalyzer` and `EditCard` now take `onEvent` (`@event` in Vue), like the Composer, ResultCard and SidePanel, so every Chai component reports what the person does. The media analyzer reports media attached and removed, the model, auto-select and prompt length picks, submit (with retry), Stop, and each analysis finishing, done or with an error. The edit card reports regions added, confirmed and removed, zoom, paging through versions, and download and share; moving and resizing a region aren't reported, since every drag would send one. As before, nothing identifying is sent: no file names, file contents or instruction text, only kinds, counts and lengths. Core adds `mediaAnalyzerEvents` and `editCardEvents`.

### Patch Changes

- Updated dependencies [a317db4]
  - @chai-ui/core@1.4.0
  - @chai-ui/tokens@1.4.0

## 1.3.0

### Minor Changes

- 0d58246: **Side panel.** `SidePanel` is a panel on the left or right of your page with a Composer and its answers, for quick questions about the page or anything else. It opens from a launcher (or your own button with `open`), starts with a greeting, the Composer and optional prompt tips, then docks the Composer under the conversation. Answers stream from your reasoning engine as plain text with like, dislike, retry and copy, or in a full ResultCard (`answers="card"`); follow-ups carry the recent turns. Page context is opt-in (`pageContext`): the page's title, URL, selected text and main text go with each question, shown as a "This page" chip the person can remove. Push or overlay layouts, either side, a full-screen sheet on narrow screens, New chat, and Close clears the conversation. Opening moves focus to the prompt, Esc closes, and closing returns focus to the launcher. Core adds `readPageContext`, `buildSidePanelPrompt` and `sidePanelEvents` (opened, closed, New chat, prompt tips by position, the page chip).
  
  The Composer gains two options any app can use: `extraMenuItems`, your own items at the top of the `+` menu, and `contextChips`, removable chips for context sent with the prompt. A long placeholder now wraps to fit while the prompt is empty instead of being cut off at one line.

### Patch Changes

- Updated dependencies [0d58246]
  - @chai-ui/core@1.3.0
  - @chai-ui/tokens@1.3.0

## 1.2.0

### Minor Changes

- 19f5e83: **Dark theme.** Set `data-chai-theme="dark"` on `<html>`, or on any element, and every component inside it switches to dark surfaces with near-white text; without the attribute nothing changes. Every text pair meets WCAG 2.2 AA contrast, the brand green moves to `green-60` for legibility, menu and picker rows hover green, and the Material switch, submit button and text field follow the theme. The values live in `tokens.json`'s new `color.dark` group, using two new root grays (`gray-15`, `gray-20`). New semantic roles, the same as before in the light theme: `menu-item-hover`, `control-pill` (the action pills on text and audio results) and `dropzone-surface` / `dropzone-border` (the Media Analyzer's drop zone). A new role without a dark value now fails the token build. Also: the Composer's focus ring is drawn over its border rather than 2px outside it, so focus shows one green edge instead of a ring plus a border.

### Patch Changes

- fb11b10: `ResultCard`: the retry icon is drawn slightly larger (about 14px instead of 12px in its 18px box), so its round glyph reads the same size as the like and dislike thumbs beside it.
- Updated dependencies [19f5e83]
  - @chai-ui/tokens@1.2.0
  - @chai-ui/core@1.2.0

## 1.1.2

### Patch Changes

- 5b66e15: READMEs: "Without a server route" for desktop apps (Tauri, Electron). The core README has the full pattern: a custom engine that forwards every run to your app's backend, the same engine as `ChaiProvider`'s `reasoningEngine`, your own `Transcribe` for voice input, and what Stop does. The React, Vue and Svelte READMEs link to it. Based on #79 by @iksnae.
- Updated dependencies [5b66e15]
  - @chai-ui/core@1.1.2
  - @chai-ui/tokens@1.1.2

## 1.1.1

### Patch Changes

- @chai-ui/core@1.1.1
  - @chai-ui/tokens@1.1.1

## 1.1.0

### Minor Changes

- 83ac142: **`style-without-fonts.css`**: the same component styles without Roboto, for apps with their own typography. Import `@chai-ui/react/style-without-fonts.css` (or the Vue or Svelte package's) in place of `style.css`, then set `--chai-type-family-material` to your font. `style.css` is unchanged and still loads Roboto, so nothing changes for existing apps.

### Patch Changes

- Updated dependencies [83ac142]
  - @chai-ui/tokens@1.1.0
  - @chai-ui/core@1.1.0

## 1.0.0

### Major Changes

- cfac12b: **1.0.0: Chai UI for Svelte.** `@chai-ui/svelte` joins React and Vue, with the same four components (`Composer`, `MediaAnalyzer`, `ResultCard`, `EditCard`), `ChaiProvider`, `useComposer`, `useMediaAnalyzer` and the primitives. React's prop names, unchanged: only `class` and a string `style` differ. Svelte 5.20 and later, in SvelteKit or plain Svelte, with no Chai-specific build setup; the components render on the server. It runs the same shared tests as React and Vue, including the axe checks. Nothing breaks for React and Vue: the major version marks the new package.
  
  Also in this release:
  
  - `buildEnhancePrompt`, Enhance's default instruction, is exported from every package, so an `enhancePrompt` can add to it instead of rewriting it.
  - Voice input in Create world adds the transcript to the field the person was last in (Environment or Character), not always to Environment.
  - `import "@chai-ui/tokens/css"` type-checks under TypeScript 6, which checks side-effect imports by default.

### Patch Changes

- Updated dependencies [cfac12b]
  - @chai-ui/tokens@1.0.0
  - @chai-ui/core@1.0.0
