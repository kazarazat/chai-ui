/**
 * The Media Analyzer's behavior with no framework: sends the attached media
 * and the instruction for its kind and prompt length
 * (`MEDIA_ANALYSIS_PROMPTS`) to the reasoning engine, and keeps the
 * generated prompt, which fills in as the text streams. A small store
 * (`getState` + `subscribe`) that `useMediaAnalyzer` (React) and the Vue
 * composable wrap.
 */
import { uniqueId } from "./unique-id.js";
import { warnNoReasoningOnce } from "./composer.js";
import { createMockEngine, isAbortError, normalizeGenerationError, type GenerationEngine } from "./engine.js";
import {
  DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH,
  MEDIA_ANALYSIS_PROMPTS,
  type MediaAnalysisPromptLength,
} from "./media-analysis-prompts.js";
import { routeModel, type ModelRoutingInput, type ModelRoutingResult } from "./model-routing.js";
import { reasoningModelFor, type Reasoning } from "./reasoning.js";
import type { DroppedMedia, MediaKind, ModelOption } from "./types.js";

export interface MediaAnalyzerAttachment extends DroppedMedia {
  id: string;
}

export interface MediaAnalyzerSubmitPayload {
  attachments: MediaAnalyzerAttachment[];
  modelId: string | null;
  /** When true, the analyzer routes among `models` at submit instead of using `modelId`. */
  autoSelectModel: boolean;
  /** The models offered for the attached media's kind. */
  models: ModelOption[];
  /** `null` until a person actually picks one — see `MediaAnalyzer`'s `promptLength` prop for why this doesn't default to "concise". */
  promptLength: MediaAnalysisPromptLength | null;
}

export interface MediaAnalyzerOptions {
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
  /** Replaces the routing instruction (`buildModelRoutingPrompt`). */
  routingPrompt?: (input: ModelRoutingInput) => string;
  /** Fires when auto-select fell back to the first listed model (no reasoning model, a failed call, or an unlisted reply). Analysis still runs. */
  onRoutingFallback?: (result: Extract<ModelRoutingResult, { status: "fallback" }>) => void;
}

export interface MediaAnalyzerState {
  analyzing: boolean;
  error: string | null;
  prompt: string | null;
}

const mockTextEngine = createMockEngine({ outputKind: "text" });

/**
 * `getOptions` is read on every call, so options can change between
 * renders; `getProvided` is the nearest provider's reasoning, if any.
 */
export function createMediaAnalyzerStore(
  getOptions: () => MediaAnalyzerOptions,
  getProvided: () => Reasoning | undefined = () => undefined
) {
  let state: MediaAnalyzerState = { analyzing: false, error: null, prompt: null };
  const listeners = new Set<() => void>();
  const set = (next: Partial<MediaAnalyzerState>) => {
    state = { ...state, ...next };
    for (const l of listeners) l();
  };

  // Each submit gets an id; a late reply from an earlier submit is dropped,
  // and its call aborted.
  let callId = 0;
  let controller: AbortController | null = null;

  function submit(payload: MediaAnalyzerSubmitPayload) {
    const opts = getOptions();
    const reasoning = getProvided();
    const id = ++callId;
    controller?.abort();
    const { signal } = (controller = new AbortController());
    set({ error: null, prompt: null });

    const kind = payload.attachments[0]?.kind;
    if (kind !== "image" && kind !== "video" && kind !== "audio") {
      const message = "Attach an image, video, or audio file to analyze.";
      set({ error: message });
      opts.onError?.(message);
      return;
    }

    const engine = opts.engine ?? reasoning?.engine ?? mockTextEngine;
    const defaultModel = opts.model ?? (reasoning ? reasoningModelFor(reasoning, payload.attachments) : undefined);
    const instruction = MEDIA_ANALYSIS_PROMPTS[kind][payload.promptLength ?? DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH];
    const current = () => id === callId;
    const autoSelect = payload.autoSelectModel && payload.models.length > 0;

    const analyze = (modelId: string | undefined) =>
      engine
        .generate({
          modelId,
          prompt: instruction,
          attachments: payload.attachments,
          onText: (text) => current() && set({ prompt: text }),
          signal,
        })
        .then(
          ({ src }) => {
            if (!current()) return;
            set({ prompt: src });
            getOptions().onResult?.(src);
          },
          (err) => {
            if (!current() || isAbortError(err)) return;
            const { message } = normalizeGenerationError(err);
            set({ error: message });
            getOptions().onError?.(message);
          }
        )
        .finally(() => current() && set({ analyzing: false }));

    set({ analyzing: true });
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
      const latest = getOptions();
      if (routed.status === "fallback") {
        if (routed.reason === "no-reasoning") warnNoReasoningOnce("analysis runs on the first listed model");
        latest.onRoutingFallback?.(routed);
      }
      latest.onModelChange?.(routed.modelId);
      return analyze(routed.modelId);
    });
  }

  /** Stops the analysis in flight (cancelling at the provider where it can), keeping any text that already streamed in. */
  function cancel() {
    callId += 1;
    controller?.abort();
    controller = null;
    set({ analyzing: false });
  }

  /** Stops anything in flight and clears the prompt and error, e.g. when the person changes their media. */
  function reset() {
    cancel();
    set({ error: null, prompt: null });
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    submit,
    cancel,
    reset,
  };
}

export type MediaAnalyzerStore = ReturnType<typeof createMediaAnalyzerStore>;

// --- Attachments and menus: what the MediaAnalyzer component shows, the same in every framework binding.

const ACCEPTED_KINDS: MediaKind[] = ["image", "video", "audio"];

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = { image: "Image", video: "Video", audio: "Audio", text: "Text" };

/** Clarifies what "Terse"/"Concise"/"Detailed" mean in the "Prompt length" menu's rows. UI copy, not sent to any model. */
export const PROMPT_LENGTH_HINT: Record<MediaAnalysisPromptLength, string> = {
  terse: "short",
  concise: "moderate",
  detailed: "long",
};

/**
 * How many attachments of each kind an analysis can hold at once. Image
 * defaults to 5 (a sequence/series reads as one analysis); video and audio
 * default to 1. Only one *kind* is ever active per analysis — these caps only
 * bound how many of that one kind can pile up before the drop zone stops
 * accepting more. `text` is output, never dropped: present only so this
 * stays a total map.
 */
export const DEFAULT_MAX_ATTACHMENTS_BY_KIND: Record<MediaKind, number> = { image: 5, video: 1, audio: 1, text: 0 };

/**
 * Applies one newly-read file to the current attachment list. Only one media
 * *kind* exists per analysis: a different kind replaces the whole list,
 * never merges. Video and audio are single-slot (a same-kind drop replaces
 * it); image fills up to `max`, then silently stops accepting more (the drop
 * zone's "maximum added" look explains why).
 */
export function nextMediaAnalyzerAttachments(
  current: MediaAnalyzerAttachment[],
  incoming: DroppedMedia,
  maxByKind: Record<MediaKind, number> = DEFAULT_MAX_ATTACHMENTS_BY_KIND
): MediaAnalyzerAttachment[] {
  const existingKind = current[0]?.kind;
  const withId: MediaAnalyzerAttachment = { ...incoming, id: uniqueId() };
  if (!existingKind || existingKind !== incoming.kind) return [withId];
  if (incoming.kind === "image") {
    if (current.length >= (maxByKind.image ?? DEFAULT_MAX_ATTACHMENTS_BY_KIND.image)) return current;
    return [...current, withId];
  }
  return [withId];
}

/** True once a same-kind drop would be rejected: only ever for image, since video and audio replace. */
export function isMediaAnalyzerAtCap(
  current: MediaAnalyzerAttachment[],
  maxByKind: Record<MediaKind, number> = DEFAULT_MAX_ATTACHMENTS_BY_KIND
): boolean {
  if (current[0]?.kind !== "image") return false;
  return current.length >= (maxByKind.image ?? DEFAULT_MAX_ATTACHMENTS_BY_KIND.image);
}

/**
 * Reads image, video and audio files as data URLs, all of them before
 * returning, so a caller applies them in drop order in one go (applying
 * each as its reader finishes would stack them on a stale list).
 * `unsupported` names the files of another type, or that couldn't be read.
 */
export async function readMediaFiles(files: Iterable<File>): Promise<{ media: DroppedMedia[]; unsupported: string[] }> {
  const unsupported: string[] = [];
  const read = await Promise.all(
    [...files].map((file) => {
      const kind = ACCEPTED_KINDS.find((k) => k === file.type.split("/")[0]);
      if (!kind) {
        unsupported.push(file.name);
        return null;
      }
      return new Promise<DroppedMedia | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ src: String(reader.result), kind, name: file.name, size: file.size });
        reader.onerror = () => {
          unsupported.push(file.name);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    })
  );
  return { media: read.filter((m): m is DroppedMedia => m !== null), unsupported };
}

/** "Replaced 2 images with clip.wav.", or `null` when nothing was replaced. */
export function replacedNote(before: MediaAnalyzerAttachment[], after: MediaAnalyzerAttachment[]): string | null {
  const removed = before.filter((a) => !after.some((n) => n.id === a.id));
  const added = after.filter((n) => !before.some((a) => a.id === n.id));
  if (removed.length === 0 || added.length === 0) return null;
  const name = (a: MediaAnalyzerAttachment) => a.name ?? MEDIA_KIND_LABEL[a.kind].toLowerCase();
  const describe = (list: MediaAnalyzerAttachment[]) =>
    list.length === 1 ? name(list[0]!) : `${list.length} ${MEDIA_KIND_LABEL[list[0]!.kind].toLowerCase()}s`;
  return `Replaced ${describe(removed)} with ${describe(added)}.`;
}

/**
 * The "Select model" menu's sections: once a kind is attached, only its
 * models (falling back to `models`); before that, all three kinds, each
 * under its own header.
 */
export function mediaAnalyzerModelSections(
  kind: MediaKind | undefined,
  modelsByKind: Partial<Record<MediaKind, ModelOption[]>>,
  models: ModelOption[]
): { label: string; options: { id: string; label: string }[] }[] {
  const options = (list: ModelOption[] = []) => list.map((m) => ({ id: m.id, label: m.label }));
  return kind
    ? [{ label: MEDIA_KIND_LABEL[kind], options: options(modelsByKind[kind] ?? models) }]
    : (["image", "video", "audio"] as const).map((k) => ({ label: MEDIA_KIND_LABEL[k], options: options(modelsByKind[k]) }));
}
