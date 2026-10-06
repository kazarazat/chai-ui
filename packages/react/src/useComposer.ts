import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildRegionEditPrompt,
  createMockEngine,
  createRun,
  deriveGenerationUseCase,
  cancelResult,
  failResult,
  isAbortError,
  mockEngine,
  normalizeGenerationError,
  PRECISE_EDIT_MODELS,
  resolveResult,
  routeModel,
  ROUTING_MODEL_ID,
  startResult,
  streamResult,
  type DroppedMedia,
  type EditRegion,
  type GenerationEngine,
  type GenerationUseCase,
  type MediaKind,
  type ModelOption,
  type ModelRoutingInput,
  type ModelRoutingResult,
  type Request,
  type Run,
} from "@chai-ui/core";
import type { ComposerSelection, ComposerSubmitPayload } from "./Composer.js";
import type { EditVersion } from "./EditCard.js";
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
  /**
   * The image to edit, when the Composer's use case is an edit (e.g.
   * `EDIT_IMAGE_USE_CASE`) and an image is attached. While it's set, the hook
   * returns `edit` for an `EditCard`, and each edit's results become new
   * versions of the image. Changing it to another image starts over.
   */
  editImage?: DroppedMedia | null;
  /** Replaces how an edit's prompt and regions become the model's prompt. Defaults to `buildRegionEditPrompt` in `@chai-ui/core`, in the model's `regionFormat`. */
  editPrompt?: (args: { prompt: string; regions: EditRegion[]; model?: ModelOption }) => string;
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

  // Edit mode. Each edit's runs are kept (not replaced by the next submit),
  // since every result is a version of the image the person can page back to.
  const editImage = options.editImage?.kind === "image" ? options.editImage : null;
  const [editRuns, setEditRuns] = useState<Run[]>([]);
  const [regions, setRegions] = useState<EditRegion[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  // Another image starts over. Reset while rendering, not in an effect (the rules of React).
  const [editSource, setEditSource] = useState<string | null>(editImage?.src ?? null);
  // Numbers each image, so its original version has its own id and EditCard
  // starts it clean (no half-drawn region from the last image).
  const [editImageCount, setEditImageCount] = useState(0);
  if ((editImage?.src ?? null) !== editSource) {
    setEditSource(editImage?.src ?? null);
    setEditImageCount((n) => n + 1);
    setEditRuns([]);
    setRegions([]);
    setActiveVersion(0);
  }
  const versions = useMemo<EditVersion[]>(
    () =>
      editImage
        ? [
            { id: `original-${editImageCount}`, src: editImage.src, status: "done", regions: [] },
            ...editRuns.flatMap((run) =>
              run.results.map((r) => ({
                id: r.id,
                src: r.output?.src,
                from: run.request.attachments[0]?.src,
                status: r.status,
                regions: (run.request.params.regions as EditRegion[] | undefined) ?? [],
                error: r.error?.message,
              }))
            ),
          ]
        : [],
    [editImage, editRuns, editImageCount]
  );
  const editRef = useLatest({ versions, activeVersion, editRuns });
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

  // One request per selection. An edit runs on the image version showing
  // in the EditCard (the original until an edit lands) and carries its regions.
  const buildRequest = useCallback(
    (payload: ComposerSubmitPayload, selection: ComposerSelection): { request: Request; engine: GenerationEngine; isEdit: boolean } => {
      const opts = optionsRef.current;
      const reasoning = reasoningRef.current;
      const isText = selection.useCase.kind === "text";
      const isEdit = Boolean(selection.useCase.edit && opts.editImage?.kind === "image");
      const { versions, activeVersion } = editRef.current;
      const shown = versions[activeVersion];
      const editFrom = shown?.status === "done" && shown.src ? shown.src : opts.editImage?.src;
      const attachments: DroppedMedia[] = isEdit && editFrom ? [{ src: editFrom, kind: "image" }] : payload.attachments;
      // Nothing picked: text uses the builder's text model when there is
      // one; otherwise the engine runs its own default. Never a silent no-op.
      const fallback = isText ? (opts.textModel ?? (reasoning && reasoningModelFor(reasoning, attachments))) : undefined;
      const params: Record<string, unknown> = payload.aspectRatio && !isEdit ? { aspectRatio: payload.aspectRatio } : {};
      if (isEdit) params.regions = payload.regions ?? [];
      const request: Request = {
        mode: deriveGenerationUseCase(selection.useCase, attachments),
        prompt: payload.value,
        attachments,
        modelIds: selection.modelIds.length > 0 ? selection.modelIds : [fallback ?? DEFAULT_MODEL_ID],
        params,
      };
      const engine = isText
        ? (opts.textEngine ?? reasoning?.engine ?? mockTextEngine)
        : (opts.engineByKind?.[selection.useCase.kind] ?? opts.engine ?? mockEngine);
      return { request, engine, isEdit };
    },
    [optionsRef, reasoningRef, editRef]
  );

  // Edit placeholders from routing waits, dropped from the history when the
  // next real runs start (including ones a newer submit abandoned).
  const placeholderIds = useRef(new Set<string>());

  const start = useCallback((payload: ComposerSubmitPayload, signal: AbortSignal) => {
    const opts = optionsRef.current;
    const newRuns = payload.selections.map((selection) => {
      const { request, engine, isEdit } = buildRequest(payload, selection);
      return { run: createRun(request), engine, isEdit, models: selection.models ?? [] };
    });

    setRuns(newRuns.map((r) => r.run));
    const newEditRuns = newRuns.filter((r) => r.isEdit).map((r) => r.run);
    const placeholders = placeholderIds.current;
    const kept = editRef.current.editRuns.filter((r) => !placeholders.has(r.id));
    if (newEditRuns.length > 0) {
      // Show the first new version, and start the next edit with no regions:
      // these ones now belong to the versions they made.
      setEditRuns([...kept, ...newEditRuns]);
      setActiveVersion(1 + kept.reduce((n, r) => n + r.results.length, 0));
      setRegions([]);
    } else if (placeholders.size > 0) {
      setEditRuns(kept);
    }
    placeholderIds.current = new Set();

    // Results settle independently and out of order — each update only
    // ever touches its own run, and only if that run is still current. A
    // run from an earlier submit is no longer in state (and its calls were
    // aborted), so a late result can't clobber the newer ones.
    const update = (runId: string, fn: (run: Run) => Run) => {
      const apply = (prev: Run[]) => (prev.some((r) => r.id === runId) ? prev.map((r) => (r.id === runId ? fn(r) : r)) : prev);
      setRuns(apply);
      setEditRuns(apply);
    };

    for (const { run: newRun, engine, isEdit, models } of newRuns) {
      opts.onRun?.(newRun);
      for (const result of newRun.results) {
        update(newRun.id, (r) => startResult(r, result.id));
        // An edit's prompt depends on the model: one with box support gets
        // boxes, any other gets the regions described in words.
        const regions = (newRun.request.params.regions as EditRegion[] | undefined) ?? [];
        const model =
          models.find((m) => m.id === result.modelId) ?? PRECISE_EDIT_MODELS.find((m) => m.id === result.modelId);
        const prompt = isEdit
          ? (opts.editPrompt ?? defaultEditPrompt)({ prompt: newRun.request.prompt, regions, model })
          : newRun.request.prompt;
        void engine
          .generate({
            modelId: result.modelId === DEFAULT_MODEL_ID ? undefined : result.modelId,
            prompt,
            attachments: newRun.request.attachments,
            aspectRatio: newRun.request.params.aspectRatio as string | undefined,
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
  }, [optionsRef, buildRequest, editRef]);

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
      // Runs exist from the moment of submit, so a result card shows progress
      // while the reasoning model chooses. Their results read "Choosing model".
      const placeholders = payload.selections.map((sel) => {
        const { request, isEdit } = buildRequest(payload, sel);
        const modelIds = sel.models.length > 0 ? [ROUTING_MODEL_ID] : request.modelIds;
        return { run: createRun({ ...request, modelIds }), isEdit };
      });
      setRuns(placeholders.map((p) => p.run));
      const editPlaceholders = placeholders.filter((p) => p.isEdit).map((p) => p.run);
      if (editPlaceholders.length > 0) {
        const editRuns = editRef.current.editRuns.filter((r) => !placeholderIds.current.has(r.id));
        for (const r of editPlaceholders) placeholderIds.current.add(r.id);
        setEditRuns([...editRuns, ...editPlaceholders]);
        setActiveVersion(1 + editRuns.reduce((n, r) => n + r.results.length, 0));
      }
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
    [start, buildRequest, optionsRef, reasoningRef, editRef]
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
    const cancelAll = (prev: Run[]) => prev.map((run) => run.results.reduce((acc, r) => cancelResult(acc, r.id), run));
    setRuns(cancelAll);
    setEditRuns(cancelAll);
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

  /** Props for an `EditCard` (spread them in), and `regions` for `Composer`. `null` when there's no `editImage`. */
  const edit = editImage
    ? {
        versions,
        activeVersion: Math.min(activeVersion, versions.length - 1),
        onActiveVersionChange: setActiveVersion,
        regions,
        onRegionsChange: setRegions,
      }
    : null;

  return { run, runs, submit, cancel, enhance, enhancing, routing, edit };
}

function defaultEditPrompt({ prompt, regions, model }: { prompt: string; regions: EditRegion[]; model?: ModelOption }): string {
  return buildRegionEditPrompt({ prompt, regions, format: model?.regionFormat });
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
