---
"@chai-ui/core": minor
---

Vercel AI Gateway as a supported engine. `createVercelEngine()` runs text (streamed, with usage, like OpenRouter) and image generation through Vercel's AI Gateway. It has no video output, since the gateway has no video endpoint yet, so use Fal.ai for video. `pingVercel()` is the connection check. `createChaiHandler` gains a `vercel` route, keyed on `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN` on Vercel), and an `aiGatewayKey` option.
