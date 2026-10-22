---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

Composer, multi-use-case select: a Model menu per use case, a model required in each, and only Image and Video combine.

- Each picked use case gets its own Model menu ("Image model", "Video model") instead of one sectioned menu summarised as "2 models". Each picks one model unless `multiSelectModels` is also on.
- Submit waits for a model in every use case, or auto-select. Before, picking only an image model let the video run on the engine's default model, which nobody chose.
- Only Image and Video combine, since they're the only use cases that can share one prompt and one Enhance rewrite. **Music, Speech, World and Edit image now run alone**: if you combined Music with Image or Video, it now replaces them. New `nextUseCases(current, picked)` applies the rule to a `+` menu pick, and `combinesWithOthers(useCase)` says whether a use case can join others. A `useCases` list that breaks the rule runs only its last pick.
