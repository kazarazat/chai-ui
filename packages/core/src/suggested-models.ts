import type { GenerationUseCase, MediaKind, ModelOption } from "./types.js";
import { DEFAULT_MAX_REGIONS } from "./region-edit.js";

/**
 * Suggested models, so builders don't have to write model lists. Composer
 * and MediaAnalyzer use them when no `models` is passed; passing `models`
 * still replaces them. The first model in each list is the default pick.
 *
 * Generation runs on Fal (the default engine), analysis on OpenRouter (the
 * reasoning engine). Every entry was checked against the provider's own
 * catalog: Fal's model schemas (`api.fal.ai/v1/models?expand=openapi-3.0`)
 * for the aspect ratios and the image field, OpenRouter's model list for
 * the input kinds. They change only through package releases; run
 * `checkSuggestedModels()` to see whether a provider has changed since.
 *
 * Checked 2026-10-06.
 */

const NANO_BANANA_RATIOS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"];
const FLUX_3_RATIOS = ["21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2"];
/** The ratios a named `image_size` covers (FLUX.1, GPT Image 2). */
const IMAGE_SIZE_RATIOS = ["1:1", "4:3", "16:9", "3:4", "9:16"];

/** Create image, from a prompt. */
export const SUGGESTED_IMAGE_MODELS: ModelOption[] = [
  { id: "fal-ai/nano-banana-pro", label: "Nano Banana Pro", provider: "Google", speed: "standard", aspectRatios: NANO_BANANA_RATIOS, falInput: { aspectRatio: "aspect_ratio" } },
  {
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    provider: "Google",
    speed: "fast",
    aspectRatios: [...NANO_BANANA_RATIOS, "4:1", "1:4", "8:1", "1:8"],
    falInput: { aspectRatio: "aspect_ratio" },
  },
  { id: "blackforestlabs/flux-3/text-to-image", label: "Flux 3 Image", provider: "Black Forest Labs", speed: "standard", aspectRatios: FLUX_3_RATIOS, falInput: { aspectRatio: "aspect_ratio" } },
  { id: "openai/gpt-image-2", label: "GPT Image 2", provider: "OpenAI", speed: "slow", aspectRatios: IMAGE_SIZE_RATIOS, falInput: { aspectRatio: "image_size" } },
  { id: "fal-ai/flux/schnell", label: "FLUX.1 schnell", provider: "Black Forest Labs", speed: "fast", aspectRatios: IMAGE_SIZE_RATIOS, falInput: { aspectRatio: "image_size" } },
];

/** Create video, from a prompt alone. */
export const SUGGESTED_TEXT_TO_VIDEO_MODELS: ModelOption[] = [
  { id: "minimax/h3-max/text-to-video", label: "MiniMax H3 Max", provider: "MiniMax", speed: "slow", aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], falInput: { aspectRatio: "aspect_ratio" } },
  { id: "bytedance/seedance-2.5/text-to-video", label: "Seedance 2.5", provider: "ByteDance", speed: "slow", aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], falInput: { aspectRatio: "aspect_ratio" } },
  { id: "fal-ai/kling-video/v3/pro/text-to-video", label: "Kling v3 Pro", provider: "Kling", speed: "slow", aspectRatios: ["16:9", "9:16", "1:1"], falInput: { aspectRatio: "aspect_ratio" } },
  { id: "fal-ai/veo3.1/fast", label: "Veo 3.1 Fast", provider: "Google", speed: "standard", aspectRatios: ["16:9", "9:16"], falInput: { aspectRatio: "aspect_ratio" } },
];

/** Create video, starting from an attached image. The video follows the image's shape, so none lists aspect ratios. */
export const SUGGESTED_IMAGE_TO_VIDEO_MODELS: ModelOption[] = [
  { id: "fal-ai/kling-video/v3/pro/image-to-video", label: "Kling v3 Pro", provider: "Kling", speed: "slow", falInput: { image: "start_image_url" } },
  { id: "minimax/h3-max/image-to-video", label: "MiniMax H3 Max", provider: "MiniMax", speed: "slow", falInput: { image: "image_url" } },
  { id: "bytedance/seedance-2.5/image-to-video", label: "Seedance 2.5", provider: "ByteDance", speed: "slow", falInput: { image: "image_url" } },
  { id: "fal-ai/veo3.1/fast/image-to-video", label: "Veo 3.1 Fast", provider: "Google", speed: "standard", falInput: { image: "image_url" } },
];

/**
 * Edit an image. Flux 3 Image reads marked regions as boxes; the others get
 * them described in words. An edit keeps the image's shape, so no aspect
 * ratios.
 */
export const SUGGESTED_EDIT_MODELS: ModelOption[] = [
  {
    id: "blackforestlabs/flux-3/edit-image",
    label: "Flux 3 Image",
    provider: "Black Forest Labs",
    speed: "standard",
    regionFormat: "flux-3-boxes",
    maxRegions: DEFAULT_MAX_REGIONS,
    falInput: { image: "image_urls" },
  },
  { id: "fal-ai/nano-banana-pro/edit", label: "Nano Banana Pro", provider: "Google", speed: "standard", falInput: { image: "image_urls" } },
  { id: "openai/gpt-image-2/edit", label: "GPT Image 2", provider: "OpenAI", speed: "slow", falInput: { image: "image_urls" } },
];

/**
 * MediaAnalyzer's models per media kind, on OpenRouter. The first in each
 * is `ChaiProvider`'s default reasoning model for that kind.
 */
export const SUGGESTED_ANALYSIS_MODELS: Partial<Record<MediaKind, ModelOption[]>> = {
  image: [
    { id: "anthropic/claude-opus-5", label: "Claude Opus 5", provider: "Anthropic", speed: "standard" },
    { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI", speed: "standard" },
    { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "Google", speed: "fast" },
    { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "Meta", speed: "standard" },
    { id: "x-ai/grok-4.5", label: "Grok 4.5", provider: "xAI", speed: "standard" },
  ],
  video: [
    { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "Google", speed: "fast" },
    { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "Google", speed: "fast" },
    { id: "amazon/nova-2-lite-v1", label: "Nova 2 Lite", provider: "Amazon", speed: "fast" },
    { id: "bytedance-seed/seed-2.0-lite", label: "Seed 2.0 Lite", provider: "ByteDance", speed: "fast" },
    { id: "moonshotai/kimi-k3", label: "Kimi K3", provider: "Moonshot", speed: "standard" },
  ],
  audio: [
    { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "Google", speed: "fast" },
    { id: "openai/gpt-audio", label: "GPT Audio", provider: "OpenAI", speed: "standard" },
    { id: "mistralai/voxtral-small-24b-2507", label: "Voxtral Small 24B", provider: "Mistral", speed: "standard" },
    { id: "xiaomi/mimo-v2.5", label: "MiMo V2.5", provider: "Xiaomi", speed: "standard" },
  ],
};

/** The suggested Fal models for a generation use case, or none (text requests use the reasoning model). */
export function suggestedModels(useCase: GenerationUseCase | undefined): ModelOption[] {
  switch (useCase) {
    case "text-to-image":
      return SUGGESTED_IMAGE_MODELS;
    case "text-to-video":
      return SUGGESTED_TEXT_TO_VIDEO_MODELS;
    case "image-to-video":
      return SUGGESTED_IMAGE_TO_VIDEO_MODELS;
    case "image-edit":
      return SUGGESTED_EDIT_MODELS;
    default:
      return [];
  }
}

/** Every suggested Fal model, by id: how the Fal engine knows each one's inputs. */
export const SUGGESTED_FAL_MODELS: ReadonlyMap<string, ModelOption> = new Map(
  [...SUGGESTED_IMAGE_MODELS, ...SUGGESTED_TEXT_TO_VIDEO_MODELS, ...SUGGESTED_IMAGE_TO_VIDEO_MODELS, ...SUGGESTED_EDIT_MODELS].map((m) => [m.id, m])
);
