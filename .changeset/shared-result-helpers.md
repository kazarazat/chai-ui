---
"@chai-ui/core": patch
"@chai-ui/react": patch
---

ResultCard's download, share and formatting helpers (`downloadMedia`, `shareMedia`, `downloadFilename`, `formatDuration`, `formatCost`, `formatTokens`, `formatAspectRatio`, `resultModelLabel`) now live in `@chai-ui/core`, so every framework binding shows results the same way. No change to how the React components behave.
