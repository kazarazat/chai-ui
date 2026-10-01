import { useCallback, useRef, useState } from "react";
import {
  createMockEngine,
  DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH,
  isAbortError,
  MEDIA_ANALYSIS_PROMPTS,
  normalizeGenerationError,
  routeModel,
  type GenerationEngine,
  type ModelRoutingInput,
  type ModelRoutingResult,
} from "@chai-ui/core";
import type { MediaAnalyzerSubmitPayload } from "./MediaAnalyzer.js";
import { reasoningModelFor, useReasoning } from "./ChaiProvider.js";
import { useLatest } from "./use-latest.js";

const mockTextEngine = createMockEngine({ outputKind: "text" });

export interface UseMediaAnalyzerOptions {
  /**
   * Overrides the nearest `ChaiProvider`'s reasoning engine. With neither,
   * a mock text engine answers, so a first render works with no key.
   */
  engine?: GenerationEngine;
  /** The model when the person hasn't picked one. Defaults to the provider's reasoning model for the media's kind. */
  model?: string;
  onResult?: (prompt: string) => void;
  onError?: (message: string) => void;
  /** Auto-select: fires with the routed model so the trigger shows it. Wire it to `MediaAnalyzer`'s `onModelChange` state. */
  onModelChange?: (modelId: string) => void;
  /** Replaces the routing instruction (`buildModelRoutingPrompt` in `@chai-ui/core`). */
  routingPrompt?: (input: ModelRoutingInput) => string;
  /** Fires when auto-select fell back to the first listed model (no reasoning model, a failed call, or an unlisted reply). Analysis still runs. */
  onRoutingFallback?: (result: Extract<ModelRoutingResult, { status: "fallback" }>) => void;
}

/**
 * The binding behind `MediaAnalyzer`'s `onSubmit`: sends the attached
 * media and the instruction for its kind and prompt length
 * (`MEDIA_ANALYSIS_PROMPTS`) to the reasoning engine, and returns the
 * generated prompt. `prompt` fills in as the text streams.
 */
export function useMediaAnalyzer(options: UseMediaAnalyzerOptions = {}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);

  const provided = useReasoning();
  const latest = useLatest({ options, provided });
  // Each submit gets an id; a late reply from an earlier submit is dropped,
  // and its call aborted.
  const callId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const submit = useCallback((payload: MediaAnalyzerSubmitPayload) => {
    const { options: opts, provided: reasoning } = latest.current;
    const id = ++callId.current;
    controller.current?.abort();
    const { signal } = (controller.current = new AbortController());
    setError(null);
    setPrompt(null);

    const kind = payload.attachments[0]?.kind;
    if (kind !== "image" && kind !== "video" && kind !== "audio") {
      const message = "Attach an image, video, or audio file to analyze.";
      setError(message);
      opts.onError?.(message);
      return;
    }

    const engine = opts.engine ?? reasoning?.engine ?? mockTextEngine;
    const defaultModel = opts.model ?? (reasoning ? reasoningModelFor(reasoning, payload.attachments) : undefined);
    const instruction = MEDIA_ANALYSIS_PROMPTS[kind][payload.promptLength ?? DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH];
    const current = () => id === callId.current;
    const autoSelect = payload.autoSelectModel && payload.models.length > 0;

    const analyze = (modelId: string | undefined) =>
      engine
        .generate({
          modelId,
          prompt: instruction,
          attachments: payload.attachments,
          onText: (text) => current() && setPrompt(text),
          signal,
        })
        .then(
          ({ src }) => {
            if (!current()) return;
            setPrompt(src);
            latest.current.options.onResult?.(src);
          },
          (err) => {
            if (!current() || isAbortError(err)) return;
            const { message } = normalizeGenerationError(err);
            setError(message);
            latest.current.options.onError?.(message);
          }
        )
        .finally(() => current() && setAnalyzing(false));

    setAnalyzing(true);
    if (!autoSelect) {
      void analyze(payload.modelId ?? defaultModel);
      return;
    }
    // Auto-select: the reasoning model looks at the media and picks the
    // analysis model first. A routing problem falls back, never blocks.
    void routeModel({
      prompt: "",
      outputKind: "text",
      attachmentKinds: payload.attachments.map((a) => a.kind),
      attachments: payload.attachments,
      models: payload.models,
      engine: opts.engine ?? reasoning?.engine,
      model: defaultModel,
      routingPrompt: opts.routingPrompt,
      signal,
    }).then((routed) => {
      if (!current() || signal.aborted) return;
      const latestOpts = latest.current.options;
      if (routed.status === "fallback") {
        if (routed.reason === "no-reasoning") warnNoReasoningOnce();
        latestOpts.onRoutingFallback?.(routed);
      }
      latestOpts.onModelChange?.(routed.modelId);
      return analyze(routed.modelId);
    });
  }, [latest]);

  /** Stops the analysis in flight (cancelling at the provider where it can), keeping any text that already streamed in. */
  const cancel = useCallback(() => {
    callId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setAnalyzing(false);
  }, []);

  /** Stops anything in flight and clears the prompt and error, e.g. when the person changes their media. */
  const reset = useCallback(() => {
    cancel();
    setError(null);
    setPrompt(null);
  }, [cancel]);

  return { submit, analyzing, error, prompt, cancel, reset };
}

export type UseMediaAnalyzerReturn = ReturnType<typeof useMediaAnalyzer>;

let warnedNoReasoning = false;
function warnNoReasoningOnce() {
  if (warnedNoReasoning) return;
  warnedNoReasoning = true;
  console.warn(
    "[chai-ui] Auto-select model is on, but there's no reasoning model, so analysis runs on the first listed model. Wrap your app in <ChaiProvider> to route with one."
  );
}
