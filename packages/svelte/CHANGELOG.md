# @chai-ui/svelte

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
