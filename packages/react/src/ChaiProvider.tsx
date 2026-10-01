import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createOpenRouterEngine, type DroppedMedia, type GenerationEngine, type MediaKind } from "@chai-ui/core";

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

const ReasoningContext = createContext<Reasoning | undefined>(undefined);

export interface ChaiProviderProps {
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
  children?: ReactNode;
}

export function ChaiProvider({ reasoningModel, reasoningModelByKind, reasoningEngine, children }: ChaiProviderProps) {
  const engine = useMemo(() => reasoningEngine ?? createOpenRouterEngine(), [reasoningEngine]);
  const model = reasoningModel ?? DEFAULT_REASONING_MODEL;
  const video = reasoningModelByKind?.video;
  const audio = reasoningModelByKind?.audio;
  const image = reasoningModelByKind?.image;
  const text = reasoningModelByKind?.text;
  const value = useMemo(
    () => ({
      engine,
      model,
      modelByKind: { ...DEFAULT_REASONING_MODEL_BY_KIND, ...dropUndefined({ video, audio, image, text }) },
    }),
    [engine, model, video, audio, image, text]
  );
  return <ReasoningContext.Provider value={value}>{children}</ReasoningContext.Provider>;
}

function dropUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** The nearest `ChaiProvider`'s reasoning engine and models, or `undefined` outside one. */
export function useReasoning(): Reasoning | undefined {
  return useContext(ReasoningContext);
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
