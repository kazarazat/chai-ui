# @chai-ui/svelte

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
