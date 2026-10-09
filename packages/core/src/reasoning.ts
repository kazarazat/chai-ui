import { createOpenRouterEngine } from "./engines/openrouter.js";
import type { GenerationEngine } from "./engine.js";
import type { DroppedMedia, MediaKind } from "./types.js";

/**
 * The suggested reasoning model for text and images: prompt enhancement,
 * auto-select routing and image analysis. A default, not a requirement —
 * pass any model id `reasoningEngine` can run.
 */
export const DEFAULT_REASONING_MODEL = "anthropic/claude-opus-5";

/**
 * Suggested per-kind overrides for media Claude can't read. Gemini takes
 * video and audio directly. For a cheaper option, swap in
 * `"qwen/qwen3.8-omni-flash"`, which takes both too.
 */
export const DEFAULT_REASONING_MODEL_BY_KIND: Partial<Record<MediaKind, string>> = {
  video: "google/gemini-3.8-flash",
  audio: "google/gemini-3.8-flash",
};

/** The reasoning engine and models every CHAI component shares. */
export interface Reasoning {
  engine: GenerationEngine;
  /** The model for text and any attachment kind without its own entry in `modelByKind`. */
  model: string;
  modelByKind: Partial<Record<MediaKind, string>>;
}

/** What a `ChaiProvider` takes, in any framework. */
export interface ReasoningConfig {
  /** Text, image and routing model. Defaults to `DEFAULT_REASONING_MODEL`. */
  reasoningModel?: string;
  /**
   * Per-attachment-kind models, merged over `DEFAULT_REASONING_MODEL_BY_KIND`
   * one kind at a time, e.g. `{ video: "qwen/qwen3.8-omni-flash" }` keeps
   * the default for audio. Map a kind to `reasoningModel`'s value to use
   * one model for everything.
   */
  reasoningModelByKind?: Partial<Record<MediaKind, string>>;
  /**
   * The engine the reasoning models run on. Defaults to OpenRouter,
   * independent of the generation engine: Fal's own LLM access is an
   * OpenRouter proxy, so defaulting to it would double-proxy.
   */
  reasoningEngine?: GenerationEngine;
}

/** A provider's `Reasoning`, from its config and the engine it holds (`config.reasoningEngine`, else one OpenRouter engine it created once). */
export function createReasoning(config: ReasoningConfig, engine: GenerationEngine): Reasoning {
  const byKind = config.reasoningModelByKind ?? {};
  const overrides = Object.fromEntries(Object.entries(byKind).filter(([, v]) => v !== undefined));
  return {
    engine,
    model: config.reasoningModel ?? DEFAULT_REASONING_MODEL,
    modelByKind: { ...DEFAULT_REASONING_MODEL_BY_KIND, ...overrides },
  };
}

/** The reasoning engine a provider uses: the one passed, else OpenRouter's. */
export function reasoningEngineFor(config: ReasoningConfig): GenerationEngine {
  return config.reasoningEngine ?? createOpenRouterEngine();
}

/**
 * A hook's or composable's own pair wins, but only as a pair: half of one
 * never mixes with half of the provider's (e.g. a hook engine with the
 * provider's model). Half a pair means no reasoning.
 */
export function pickReasoning(
  own: { reasoningEngine?: GenerationEngine; reasoningModel?: string },
  provided: Reasoning | undefined
): Reasoning | undefined {
  const { reasoningEngine, reasoningModel } = own;
  if (!reasoningEngine && !reasoningModel) return provided;
  return reasoningEngine && reasoningModel ? { engine: reasoningEngine, model: reasoningModel, modelByKind: {} } : undefined;
}

/**
 * The reasoning model for a call with these attachments: the first
 * attachment whose kind has its own model wins (a clip plus a still goes
 * to the model that can read the clip), else `reasoning.model`.
 */
export function reasoningModelFor(reasoning: Reasoning, attachments: DroppedMedia[] = []): string {
  for (const { kind } of attachments) {
    const model = reasoning.modelByKind[kind];
    if (model) return model;
  }
  return reasoning.model;
}
