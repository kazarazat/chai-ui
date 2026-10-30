---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/svelte": patch
---

**Submit needs a prompt.** The Composer let a person submit with only an attachment and no prompt, sending the model an empty prompt: an image model then errored or made something unrelated, since media alone doesn't say what to make. Submit now stays off until there's a prompt, for every use case. In edit mode a region still counts on its own, since each region carries its own instruction. The side panel's Composer follows the same rule.
