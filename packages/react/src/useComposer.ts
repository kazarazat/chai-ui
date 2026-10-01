import { useCallback, useMemo, useRef, useState } from "react";
import {
  createMockEngine,
  createRun,
  deriveGenerationUseCase,
  cancelResult,
  failResult,
  isAbortError,
  mockEngine,
  normalizeGenerationError,
  resolveResult,
  routeModel,
  startResult,
  streamResult,
  type GenerationEngine,
  type GenerationUseCase,
  type MediaKind,
  type ModelRoutingInput,
  type ModelRoutingResult,
  type Request,
  type Run,
} from "@chai-ui/core";
import type { ComposerSubmitPayload } from "./Composer.js";
import { reasoningModelFor, useReasoning, type Reasoning } from "./ChaiProvider.js";
import { useLatest } from "./use-latest.js";

/** A result's `modelId` when nothing was picked: the engine runs its own default model. */
export const DEFAULT_MODEL_ID = "default";

const mockTextEngine = createMockEngine({ outputKind: "text" });

function defaultEnhancePrompt(value: string, mode?: GenerationUseCase): string {
  const subject = mode?.includes("video")
    ? "a video-generation"
    : mode === "text-to-text" || mode === "vision"
      ? "an AI assistant"
      : "an image-generation";
  return `Rewrite the following ${subject} prompt to be more detailed and specific, keeping the same intent. Reply with only the rewritten prompt, nothing else.\n\n${value}`;
}

export interface UseComposerOptions {
  /** The generation engine a submitted run actually calls. Defaults to `mockEngine`. */
  engine?: GenerationEngine;
  /**
   * Engines per use-case kind, overriding `engine` for that kind — needed
   * for multi-use-case select, since one Fal engine outputs one kind, e.g.
   * `{ image: createFalEngine({ outputKind: "image" }), video: createFalEngine({ outputKind: "video" }) }`.
   */
  engineByKind?: Partial<Record<MediaKind, GenerationEngine>>;
  /**
   * The engine for text requests (a Composer with no use case picked, or a
   * text use case). Defaults to `reasoningEngine`, and to a mock text engine
   * when neither is set, so a text prompt always gets a reply.
   */
  textEngine?: GenerationEngine;
  /** The model text requests use when none is picked. Defaults to the reasoning model for the attachments' kinds, then the text engine's own default. */
  textModel?: string;
  /**
   * The reasoning engine Enhance calls — deliberately separate from
   * `engine`: Fal's own text/vision access is itself an
   * OpenRouter proxy, so defaulting Enhance to a Fal `engine` would
   * silently double-proxy. Must return text. Set together with
   * `reasoningModel` to override the nearest `ChaiProvider`'s pair; with
   * neither set here nor a provider, `enhance` stays `undefined`, same
   * shape as `Composer`'s own "omit `onEnhance` to hide the button" convention.
   */
  reasoningEngine?: GenerationEngine;
  /** Set with `reasoningEngine` to override the provider's pair; used for every kind (§5.5). */
  reasoningModel?: string;
  /** Overrides the instruction wrapping a raw prompt for Enhance. Defaults to a generic still/video-aware rewrite instruction. */
  enhancePrompt?: (value: string, mode?: GenerationUseCase) => string;
  /**
   * Auto-select: with `autoSelectModel` on in the payload, the reasoning
   * model picks one model per use case at submit, then these fire with the
   * pick so the Composer's trigger shows it. Wire them to the same state as
   * Composer's `onModelChange` / `onModelIdsChange`.
   */
  onModelChange?: (modelId: string) => void;
  onModelIdsChange?: (modelIds: string[]) => void;
  /** Replaces the routing instruction (`buildModelRoutingPrompt` in `@chai-ui/core`). */
  routingPrompt?: (input: ModelRoutingInput) => string;
  /**
   * Fires when auto-select couldn't route and fell back to the first listed
   * model: no reasoning model, a failed reasoning call (e.g. a bad key), or
   * a reply naming no listed model. The request still runs.
   */
  onRoutingFallback?: (result: Extract<ModelRoutingResult, { status: "fallback" }>) => void;
  onRun?: (run: Run) => void;
  onResult?: (run: Run, resultId: string) => void;
  onError?: (run: Run, resultId: string) => void;
}

/**
 * The headless binding the design promises and the package README
 * flagged as missing: turns a `Composer`'s `onSubmit` payload into a real
 * `Request` → `Run` → `Result` (§6), fanning out across `engine.generate`
 * calls and folding each one back into state as it settles — pure
 * transitions live in `@chai-ui/core`, this is the thin React binding.
 */
export function useComposer(options: UseComposerOptions = {}) {
  // One run per use case submitted: a single run unless the Composer has
  // `multiSelectUseCases` on. `run` stays as the first, for the common case.
  const [runs, setRuns] = useState<Run[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [routing, setRouting] = useState(false);
  // Each submit gets an id, so routing that settles after a newer submit is dropped.
  const submitId = useRef(0);
  // Aborts the current submit's engine calls: on `cancel()`, and when a newer
  // submit replaces it (its results would be dropped anyway).
  const controller = useRef<AbortController | null>(null);

  // `submit` below reads through a ref so it can stay referentially stable (empty dep array — safe to
  // pass to a memoized child) while always seeing this render's latest
  // options, not the ones captured when `submit` was first created.
  const optionsRef = useLatest(options);

  // The hook's own pair wins, but only as a pair: half of one never mixes
  // with half of the provider's (e.g. a hook engine with the provider's model).
  const provided = useReasoning();
  const { reasoningEngine, reasoningModel } = options;
  const reasoning = useMemo<Reasoning | undefined>(
    () =>
      reasoningEngine || reasoningModel
        ? reasoningEngine && reasoningModel
          ? { engine: reasoningEngine, model: reasoningModel, modelByKind: {} }
          : undefined
        : provided,
    [reasoningEngine, reasoningModel, provided]
  );
  const reasoningRef = useLatest(reasoning);

  const start = useCallback((payload: ComposerSubmitPayload, signal: AbortSignal) => {
    const opts = optionsRef.current;
    const reasoning = reasoningRef.current;
    const newRuns = payload.selections.map((selection) => {
      const isText = selection.useCase.kind === "text";
      // Nothing picked: text uses the builder's text model when there is
      // one; otherwise the engine runs its own default. Never a silent no-op.
      const fallback = isText ? (opts.textModel ?? (reasoning && reasoningModelFor(reasoning, payload.attachments))) : undefined;
      const request: Request = {
        mode: deriveGenerationUseCase(selection.useCase, payload.attachments),
        prompt: payload.value,
        attachments: payload.attachments,
        modelIds: selection.modelIds.length > 0 ? selection.modelIds : [fallback ?? DEFAULT_MODEL_ID],
        params: payload.aspectRatio ? { aspectRatio: payload.aspectRatio } : {},
      };
      const engine = isText
        ? (opts.textEngine ?? reasoning?.engine ?? mockTextEngine)
        : (opts.engineByKind?.[selection.useCase.kind] ?? opts.engine ?? mockEngine);
      return { run: createRun(request), engine };
    });

    setRuns(newRuns.map((r) => r.run));

    // Results settle independently and out of order — each update only
    // ever touches its own run, and only if that run is still current. A
    // run from an earlier submit is no longer in state (and its calls were
    // aborted), so a late result can't clobber the newer ones.
    const update = (runId: string, fn: (run: Run) => Run) =>
      setRuns((prev) => (prev.some((r) => r.id === runId) ? prev.map((r) => (r.id === runId ? fn(r) : r)) : prev));

    for (const { run: newRun, engine } of newRuns) {
      opts.onRun?.(newRun);
      for (const result of newRun.results) {
        update(newRun.id, (r) => startResult(r, result.id));
        void engine
          .generate({
            modelId: result.modelId === DEFAULT_MODEL_ID ? undefined : result.modelId,
            prompt: newRun.request.prompt,
            attachments: newRun.request.attachments,
            // Text engines that stream fill `output` in while still "running".
            onText: (text) => update(newRun.id, (r) => streamResult(r, result.id, text)),
            signal,
          })
          .then(
            ({ src, kind, usage, evaluations }) => {
              update(newRun.id, (r) => resolveResult(r, result.id, { src, kind }, usage, evaluations));
              optionsRef.current.onResult?.(newRun, result.id);
            },
            (err) => {
              if (isAbortError(err)) return update(newRun.id, (r) => cancelResult(r, result.id));
              update(newRun.id, (r) => failResult(r, result.id, normalizeGenerationError(err)));
              optionsRef.current.onError?.(newRun, result.id);
            }
          );
      }
    }
  }, [optionsRef, reasoningRef]);

  const submit = useCallback(
    (payload: ComposerSubmitPayload) => {
      const id = ++submitId.current;
      controller.current?.abort();
      const { signal } = (controller.current = new AbortController());
      const toRoute = payload.autoSelectModel && payload.selections.some((sel) => sel.models.length > 0);
      if (!toRoute) {
        setRouting(false);
        start(payload, signal);
        return;
      }

      const opts = optionsRef.current;
      const reasoning = reasoningRef.current;
      if (!reasoning) warnNoReasoningOnce();
      setRouting(true);
      void Promise.all(
        payload.selections.map((sel) =>
          sel.models.length === 0
            ? Promise.resolve(null)
            : routeModel({
                prompt: payload.value,
                outputKind: sel.useCase.kind,
                attachmentKinds: payload.attachments.map((a) => a.kind),
                attachments: payload.attachments,
                models: sel.models,
                engine: reasoning?.engine,
                model: reasoning && reasoningModelFor(reasoning, payload.attachments),
                routingPrompt: opts.routingPrompt,
                signal,
              })
        )
      ).then((results) => {
        if (id !== submitId.current || signal.aborted) return;
        setRouting(false);
        const latest = optionsRef.current;
        for (const r of results) if (r?.status === "fallback") latest.onRoutingFallback?.(r);
        const routedIds = results.flatMap((r) => (r ? [r.modelId] : []));
        if (latest.onModelIdsChange) latest.onModelIdsChange(routedIds);
        else if (routedIds[0]) latest.onModelChange?.(routedIds[0]);
        start({
          ...payload,
          modelId: routedIds[0] ?? payload.modelId,
          selections: payload.selections.map((sel, i) => ({
            ...sel,
            modelIds: results[i] ? [results[i]!.modelId] : sel.modelIds,
          })),
        }, signal);
      });
    },
    [start, optionsRef, reasoningRef]
  );

  /**
   * Stops the current submit: wire it to Composer's `onAbort`. Its
   * unfinished results turn `"cancelled"` right away, and each engine
   * cancels at the provider where it can (best effort: some providers keep
   * running, and billing, once a request has started).
   */
  const cancel = useCallback(() => {
    submitId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setRouting(false);
    setRuns((prev) => prev.map((run) => run.results.reduce((acc, r) => cancelResult(acc, r.id), run)));
  }, []);

  const run = runs[0] ?? null;

  // `undefined` (not a no-op function) when unconfigured, so a consumer
  // can write `onEnhance={enhance}` directly — matching how `Composer`
  // itself treats an omitted `onEnhance` as "hide the button entirely",
  // rather than needing an `enhance ? enhance : undefined` at every call site.
  const enhance = useMemo(() => {
    if (!reasoning) return undefined;
    return async (value: string) => {
      setEnhancing(true);
      try {
        const prompt = (options.enhancePrompt ?? defaultEnhancePrompt)(value, run?.request.mode);
        const { src } = await reasoning.engine.generate({ modelId: reasoning.model, prompt, attachments: [] });
        return src;
      } finally {
        setEnhancing(false);
      }
    };
  }, [reasoning, options.enhancePrompt, run?.request.mode]);

  return { run, runs, submit, cancel, enhance, enhancing, routing };
}

export type UseComposerReturn = ReturnType<typeof useComposer>;

let warnedNoReasoning = false;
function warnNoReasoningOnce() {
  if (warnedNoReasoning) return;
  warnedNoReasoning = true;
  console.warn(
    "[chai-ui] Auto-select model is on, but there's no reasoning model, so each request runs on the first listed model. Wrap your app in <ChaiProvider> to route with one."
  );
}
