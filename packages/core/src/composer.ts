/**
 * The Composer's behavior with no framework: turns a submit payload into
 * `Request` → `Run` → `Result` (§6), fanning out across `engine.generate`
 * calls and folding each one back into state as it settles. A small store
 * (`getState` + `subscribe`) that `useComposer` (React) and the Vue
 * composable wrap; the pure transitions live in `run.ts`.
 */
import {
  createMockEngine,
  isAbortError,
  mockEngine,
  normalizeGenerationError,
  type GenerationEngine,
} from "./engine.js";
import { routeModel, type ModelRoutingInput, type ModelRoutingResult } from "./model-routing.js";
import { buildRegionEditPrompt, PRECISE_EDIT_MODELS, type EditRegion } from "./region-edit.js";
import { pickReasoning, reasoningModelFor, type Reasoning } from "./reasoning.js";
import {
  cancelResult,
  createRun,
  deriveGenerationUseCase,
  failResult,
  resolveResult,
  ROUTING_MODEL_ID,
  startResult,
  streamResult,
  type Request,
  type ResultStatus,
  type Run,
} from "./run.js";
import type { DroppedMedia, GenerationUseCase, MediaKind, ModelOption } from "./types.js";

export interface ComposerAttachment extends DroppedMedia {
  id: string;
}

/**
 * The selected generation use case, shown as a removable chip (reference:
 * the mock's "Video"/"Image" chip) — deliberately independent of
 * `attachments`: a use case can be picked from the attach menu with nothing
 * attached yet (e.g. "Create video"). Composer never derives this from
 * `attachments` itself (that's app-level policy, not a Composer opinion —
 * the design). With none picked, `defaultUseCase` applies.
 */
export interface ComposerUseCase {
  kind: MediaKind;
  label: string;
  /**
   * An edit of the attached image rather than a new one: no aspect ratio,
   * region chips when `regions` is set, and a submit needs only an image and
   * either a prompt or a region. Images only for now.
   */
  edit?: boolean;
}

/** A plain text request — what a submit means when no use case is picked, unless the builder sets `defaultUseCase`. */
export const TEXT_USE_CASE: ComposerUseCase = { kind: "text", label: "Text" };

/** Editing the attached image, the attach menu's "Edit image". Pair it with `useComposer`'s `editImage` and an `EditCard`. */
export const EDIT_IMAGE_USE_CASE: ComposerUseCase = { kind: "image", label: "Edit image", edit: true };

/** One use case to run and the models picked for it. Empty `modelIds` means the engine's default model. */
export interface ComposerSelection {
  useCase: ComposerUseCase;
  modelIds: string[];
  /** The models offered for this use case: what auto-select routes among. */
  models: ModelOption[];
}

/**
 * Everything Composer itself tracks, assembled into one object at submit
 * time — an honest snapshot of the component's own state, handed to
 * `onSubmit` so a builder doesn't have to re-derive it from five
 * separately-controlled props they already hold.
 */
export interface ComposerSubmitPayload {
  value: string;
  attachments: ComposerAttachment[];
  /** The use case to run — the picked one, or `defaultUseCase` when none is picked. The first one with `multiSelectUseCases`. */
  useCase: ComposerUseCase;
  /** The first picked model, or null for the engine's default. */
  modelId: string | null;
  aspectRatio: string | null;
  /** Everything to run: one entry per use case with its picked models. A single entry unless `multiSelectUseCases` is on. */
  selections: ComposerSelection[];
  /** When true, the model is chosen at submit (`useComposer` routes among each selection's `models`), not by the picks. */
  autoSelectModel: boolean;
  /** An edit's marked regions, each with its own instruction. Empty unless the use case is an edit. */
  regions?: EditRegion[];
}

/**
 * One version of the image being edited: the original, or the result of an
 * edit. The composer's `edit.versions` builds these from its runs.
 */
export interface EditVersion {
  id: string;
  /** The image, once there is one. */
  src?: string;
  /** The image this version was edited from, shown under the progress spinner until `src` arrives. */
  from?: string;
  status: ResultStatus;
  /** The regions this version was made with (none for the original). Shown faintly, for reference. */
  regions: EditRegion[];
  error?: string;
}

/** A result's `modelId` when nothing was picked: the engine runs its own default model. */
export const DEFAULT_MODEL_ID = "default";

export interface ComposerOptions {
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
  /** Replaces the routing instruction (`buildModelRoutingPrompt`). */
  routingPrompt?: (input: ModelRoutingInput) => string;
  /**
   * Fires when auto-select couldn't route and fell back to the first listed
   * model: no reasoning model, a failed reasoning call (e.g. a bad key), or
   * a reply naming no listed model. The request still runs.
   */
  onRoutingFallback?: (result: Extract<ModelRoutingResult, { status: "fallback" }>) => void;
  /**
   * The image to edit, when the Composer's use case is an edit (e.g.
   * `EDIT_IMAGE_USE_CASE`) and an image is attached. While it's set, `edit`
   * returns props for an `EditCard`, and each edit's results become new
   * versions of the image. Changing it to another image starts over.
   */
  editImage?: DroppedMedia | null;
  /** Replaces how an edit's prompt and regions become the model's prompt. Defaults to `buildRegionEditPrompt`, in the model's `regionFormat`. */
  editPrompt?: (args: { prompt: string; regions: EditRegion[]; model?: ModelOption }) => string;
  onRun?: (run: Run) => void;
  onResult?: (run: Run, resultId: string) => void;
  onError?: (run: Run, resultId: string) => void;
}

export interface ComposerState {
  /** One run per use case submitted: a single run unless the Composer has `multiSelectUseCases` on. */
  runs: Run[];
  enhancing: boolean;
  routing: boolean;
  /** Edit mode. Each edit's runs are kept (not replaced by the next submit), since every result is a version of the image the person can page back to. */
  editRuns: Run[];
  regions: EditRegion[];
  activeVersion: number;
  /** The image the edit state belongs to. Another image starts over. */
  editSource: string | null;
  /** Numbers each image, so its original version has its own id and EditCard starts it clean. */
  editImageCount: number;
}

/** Props for an `EditCard` (spread them in), and `regions` for `Composer`. */
export interface ComposerEdit {
  versions: EditVersion[];
  activeVersion: number;
  onActiveVersionChange: (index: number) => void;
  regions: EditRegion[];
  onRegionsChange: (regions: EditRegion[]) => void;
}

const mockTextEngine = createMockEngine({ outputKind: "text" });

function defaultEnhancePrompt(value: string, mode?: GenerationUseCase): string {
  const subject = mode?.includes("video")
    ? "a video-generation"
    : mode === "text-to-text" || mode === "vision"
      ? "an AI assistant"
      : "an image-generation";
  return `Rewrite the following ${subject} prompt to be more detailed and specific, keeping the same intent. Reply with only the rewritten prompt, nothing else.\n\n${value}`;
}

function defaultEditPrompt({ prompt, regions, model }: { prompt: string; regions: EditRegion[]; model?: ModelOption }): string {
  return buildRegionEditPrompt({ prompt, regions, format: model?.regionFormat });
}

const imageOnly = (media: DroppedMedia | null | undefined) => (media?.kind === "image" ? media : null);

/**
 * `getOptions` is read on every call, so options can change between
 * renders; `getProvided` is the nearest provider's reasoning, if any.
 */
export function createComposerStore(getOptions: () => ComposerOptions, getProvided: () => Reasoning | undefined = () => undefined) {
  let state: ComposerState = {
    runs: [],
    enhancing: false,
    routing: false,
    editRuns: [],
    regions: [],
    activeVersion: 0,
    editSource: imageOnly(getOptions().editImage)?.src ?? null,
    editImageCount: 0,
  };
  const listeners = new Set<() => void>();

  // Edit state belongs to one image: a read sees another image's state as
  // empty, and the first write after the change actually clears it.
  const forImage = (s: ComposerState, image = imageOnly(getOptions().editImage)): ComposerState => {
    const src = image?.src ?? null;
    return src === s.editSource
      ? s
      : { ...s, editSource: src, editImageCount: s.editImageCount + 1, editRuns: [], regions: [], activeVersion: 0 };
  };
  const set = (fn: (s: ComposerState) => Partial<ComposerState>) => {
    const current = forImage(state);
    state = { ...current, ...fn(current) };
    for (const l of listeners) l();
  };

  let versionsCache: { image: DroppedMedia | null; editRuns: Run[]; count: number; versions: EditVersion[] } | null = null;
  const versionsOf = (s: ComposerState, image: DroppedMedia | null): EditVersion[] => {
    if (versionsCache && versionsCache.image === image && versionsCache.editRuns === s.editRuns && versionsCache.count === s.editImageCount) {
      return versionsCache.versions;
    }
    const versions: EditVersion[] = image
      ? [
          { id: `original-${s.editImageCount}`, src: image.src, status: "done", regions: [] },
          ...s.editRuns.flatMap((run) =>
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
      : [];
    versionsCache = { image, editRuns: s.editRuns, count: s.editImageCount, versions };
    return versions;
  };

  const reasoning = () => pickReasoning(getOptions(), getProvided());

  // Each submit gets an id, so routing that settles after a newer submit is dropped.
  let submitId = 0;
  // Aborts the current submit's engine calls: on `cancel()`, and when a newer
  // submit replaces it (its results would be dropped anyway).
  let controller: AbortController | null = null;
  // Edit placeholders from routing waits, dropped from the history when the
  // next real runs start (including ones a newer submit abandoned).
  let placeholderIds = new Set<string>();

  // One request per selection. An edit runs on the image version showing
  // in the EditCard (the original until an edit lands) and carries its regions.
  function buildRequest(payload: ComposerSubmitPayload, selection: ComposerSelection) {
    const opts = getOptions();
    const r = reasoning();
    const isText = selection.useCase.kind === "text";
    const isEdit = Boolean(selection.useCase.edit && opts.editImage?.kind === "image");
    const image = imageOnly(opts.editImage);
    const s = forImage(state, image);
    const shown = versionsOf(s, image)[s.activeVersion];
    const editFrom = shown?.status === "done" && shown.src ? shown.src : opts.editImage?.src;
    const attachments: DroppedMedia[] = isEdit && editFrom ? [{ src: editFrom, kind: "image" }] : payload.attachments;
    // Nothing picked: text uses the builder's text model when there is
    // one; otherwise the engine runs its own default. Never a silent no-op.
    const fallback = isText ? (opts.textModel ?? (r && reasoningModelFor(r, attachments))) : undefined;
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
      ? (opts.textEngine ?? r?.engine ?? mockTextEngine)
      : (opts.engineByKind?.[selection.useCase.kind] ?? opts.engine ?? mockEngine);
    return { request, engine, isEdit };
  }

  function start(payload: ComposerSubmitPayload, signal: AbortSignal) {
    const opts = getOptions();
    const newRuns = payload.selections.map((selection) => {
      const { request, engine, isEdit } = buildRequest(payload, selection);
      return { run: createRun(request), engine, isEdit, models: selection.models ?? [] };
    });

    const placeholders = placeholderIds;
    placeholderIds = new Set();
    set((s) => {
      const newEditRuns = newRuns.filter((r) => r.isEdit).map((r) => r.run);
      const kept = s.editRuns.filter((r) => !placeholders.has(r.id));
      const runs = newRuns.map((r) => r.run);
      // Show the first new version, and start the next edit with no regions:
      // these ones now belong to the versions they made.
      if (newEditRuns.length > 0) {
        return {
          runs,
          editRuns: [...kept, ...newEditRuns],
          activeVersion: 1 + kept.reduce((n, r) => n + r.results.length, 0),
          regions: [],
        };
      }
      return placeholders.size > 0 ? { runs, editRuns: kept } : { runs };
    });

    // Results settle independently and out of order — each update only
    // ever touches its own run, and only if that run is still current. A
    // run from an earlier submit is no longer in state (and its calls were
    // aborted), so a late result can't clobber the newer ones.
    const update = (runId: string, fn: (run: Run) => Run) => {
      const apply = (prev: Run[]) => (prev.some((r) => r.id === runId) ? prev.map((r) => (r.id === runId ? fn(r) : r)) : prev);
      set((s) => ({ runs: apply(s.runs), editRuns: apply(s.editRuns) }));
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
              getOptions().onResult?.(newRun, result.id);
            },
            (err) => {
              if (isAbortError(err)) return update(newRun.id, (r) => cancelResult(r, result.id));
              update(newRun.id, (r) => failResult(r, result.id, normalizeGenerationError(err)));
              getOptions().onError?.(newRun, result.id);
            }
          );
      }
    }
  }

  function submit(payload: ComposerSubmitPayload) {
    const id = ++submitId;
    controller?.abort();
    const { signal } = (controller = new AbortController());
    const toRoute = payload.autoSelectModel && payload.selections.some((sel) => sel.models.length > 0);
    if (!toRoute) {
      if (state.routing) set(() => ({ routing: false }));
      start(payload, signal);
      return;
    }

    const opts = getOptions();
    const r = reasoning();
    if (!r) warnNoReasoningOnce("each request runs on the first listed model");
    // Runs exist from the moment of submit, so a result card shows progress
    // while the reasoning model chooses. Their results read "Choosing model".
    const placeholders = payload.selections.map((sel) => {
      const { request, isEdit } = buildRequest(payload, sel);
      const modelIds = sel.models.length > 0 ? [ROUTING_MODEL_ID] : request.modelIds;
      return { run: createRun({ ...request, modelIds }), isEdit };
    });
    set((s) => {
      const next: Partial<ComposerState> = { routing: true, runs: placeholders.map((p) => p.run) };
      const editPlaceholders = placeholders.filter((p) => p.isEdit).map((p) => p.run);
      if (editPlaceholders.length > 0) {
        const editRuns = s.editRuns.filter((run) => !placeholderIds.has(run.id));
        for (const run of editPlaceholders) placeholderIds.add(run.id);
        next.editRuns = [...editRuns, ...editPlaceholders];
        next.activeVersion = 1 + editRuns.reduce((n, run) => n + run.results.length, 0);
      }
      return next;
    });
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
              engine: r?.engine,
              model: r && reasoningModelFor(r, payload.attachments),
              routingPrompt: opts.routingPrompt,
              signal,
            })
      )
    ).then((results) => {
      if (id !== submitId || signal.aborted) return;
      set(() => ({ routing: false }));
      const latest = getOptions();
      for (const res of results) if (res?.status === "fallback") latest.onRoutingFallback?.(res);
      const routedIds = results.flatMap((res) => (res ? [res.modelId] : []));
      if (latest.onModelIdsChange) latest.onModelIdsChange(routedIds);
      else if (routedIds[0]) latest.onModelChange?.(routedIds[0]);
      start(
        {
          ...payload,
          modelId: routedIds[0] ?? payload.modelId,
          selections: payload.selections.map((sel, i) => ({
            ...sel,
            modelIds: results[i] ? [results[i]!.modelId] : sel.modelIds,
          })),
        },
        signal
      );
    });
  }

  /**
   * Stops the current submit: wire it to Composer's `onAbort`. Its
   * unfinished results turn `"cancelled"` right away, and each engine
   * cancels at the provider where it can (best effort: some providers keep
   * running, and billing, once a request has started).
   */
  function cancel() {
    submitId += 1;
    controller?.abort();
    controller = null;
    const cancelAll = (prev: Run[]) => prev.map((run) => run.results.reduce((acc, r) => cancelResult(acc, r.id), run));
    set((s) => ({ routing: false, runs: cancelAll(s.runs), editRuns: cancelAll(s.editRuns) }));
  }

  /** Rewrites a prompt with the reasoning model. Only offer it when `reasoning()` is set. */
  async function enhance(value: string): Promise<string> {
    const r = reasoning();
    if (!r) throw new Error("[chai-ui] Enhance needs a reasoning engine and model.");
    set(() => ({ enhancing: true }));
    try {
      const prompt = (getOptions().enhancePrompt ?? defaultEnhancePrompt)(value, state.runs[0]?.request.mode);
      const { src } = await r.engine.generate({ modelId: r.model, prompt, attachments: [] });
      return src;
    } finally {
      set(() => ({ enhancing: false }));
    }
  }

  const setActiveVersion = (activeVersion: number) => set(() => ({ activeVersion }));
  const setRegions = (regions: EditRegion[]) => set(() => ({ regions }));

  /**
   * The `EditCard` props for a state and the current `editImage`, or `null`
   * without one. Pure, so a binding can call it while rendering with that
   * render's options.
   */
  function edit(s: ComposerState, editImage: DroppedMedia | null | undefined): ComposerEdit | null {
    const image = imageOnly(editImage);
    if (!image) return null;
    const current = forImage(s, image);
    const versions = versionsOf(current, image);
    return {
      versions,
      activeVersion: Math.min(current.activeVersion, versions.length - 1),
      onActiveVersionChange: setActiveVersion,
      regions: current.regions,
      onRegionsChange: setRegions,
    };
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    submit,
    cancel,
    enhance,
    edit,
    reasoning,
  };
}

export type ComposerStore = ReturnType<typeof createComposerStore>;

const warned = new Set<string>();
/** One console warning per message per page load: auto-select is on with no reasoning model to route with. */
export function warnNoReasoningOnce(consequence: string) {
  if (warned.has(consequence)) return;
  warned.add(consequence);
  console.warn(
    `[chai-ui] Auto-select model is on, but there's no reasoning model, so ${consequence}. Wrap your app in <ChaiProvider> to route with one.`
  );
}
