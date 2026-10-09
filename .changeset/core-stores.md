---
"@chai-ui/core": patch
"@chai-ui/react": patch
---

The Composer's and Media Analyzer's behavior now lives in `@chai-ui/core` as framework-free stores (`createComposerStore`, `createMediaAnalyzerStore`), along with the reasoning helpers and the shared Composer types. `useComposer`, `useMediaAnalyzer` and `ChaiProvider` wrap them and work exactly as before. This is groundwork for the Vue package.
