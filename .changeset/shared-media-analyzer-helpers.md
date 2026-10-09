---
"@chai-ui/core": patch
"@chai-ui/react": patch
---

MediaAnalyzer's attachment rules and file reading (`nextMediaAnalyzerAttachments`, `isMediaAnalyzerAtCap`, `DEFAULT_MAX_ATTACHMENTS_BY_KIND`, `readMediaFiles`, `replacedNote`, `mediaAnalyzerModelSections`) now live in `@chai-ui/core`; `@chai-ui/react` still exports the first three. No change to how the React component behaves.
