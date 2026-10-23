---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/tokens": minor
---

Evaluations: an opt-in judge for quality checks. `useComposer({ judgeModel, judgeChecks })` has a model you name check each text or image result against your own criteria on the reasoning engine, adding one pass or fail tag per check to the result's `evaluations`, after any your backend added.

- Off by default, with no default model. Video results aren't judged.
- `judgeChecks` is a list of `{ id, label, criterion, kind? }`, where `kind` limits a check to text or image results. Without it, one "Matches prompt" check runs (`DEFAULT_EVALUATION_CHECKS`).
- The judge's prompt is the exported `buildJudgePrompt`. `judgePrompt` replaces it.
- A reply the judge model gives without readable verdicts, or a failed judge call, adds no tags and logs one console warning.
