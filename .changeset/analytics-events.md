---
"@chai-ui/core": minor
"@chai-ui/react": minor
"@chai-ui/vue": minor
"@chai-ui/tokens": minor
---

Analytics: an `onEvent` prop on `Composer` and `ResultCard` (`@event` in Vue) reports what the person does and sees, one `ChaiEvent` each, for any analytics tool: `onEvent={(e) => posthog.capture(e.name, e.properties)}`.

- **Composer:** `chai_composer_submitted`, `_stopped`, `_use_case_picked`, `_use_case_removed`, `_media_attached`, `_model_picked`, `_auto_select_toggled`, `_option_picked`, `_enhance_clicked`, `_enhance_reverted` and `_voice_started`.
- **ResultCard:** `chai_result_shown` (once per result, done or failed), `chai_result_action`, `chai_result_paged` and `chai_result_info_opened`.
- **Front end only, and private by design:** no prompt text, file names, URLs or outputs, only lengths, counts and Chai's own ids. Model calls, latency and cost belong to your back end.
- **New exports:** the `ChaiEvent` type and its builders, `composerEvents` and `resultCardEvents`.
