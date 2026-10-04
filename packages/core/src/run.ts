/**
 * The the design data model — Request/Run/Result — plus the pure state
 * transitions over it: pure, framework-free logic here; `useComposer`
 * (`@chai-ui/react`) is the thin React binding on top.
 */

import type { DroppedMedia, Evaluation, GenerationUseCase, MediaKind, Usage } from "./types.js";

export interface Request {
  /** The specific generation use case, when one could be derived — see `deriveGenerationUseCase`. Undefined when the use case (or its kind) has no `GenerationUseCase` match yet, e.g. audio. */
  mode?: GenerationUseCase;
  prompt: string;
  attachments: DroppedMedia[];
  modelIds: string[];
  params: Record<string, unknown>;
  presetId?: string;
}

/** `"cancelled"`: the person stopped it. A streamed text result keeps the text that arrived. */
export type ResultStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface Result {
  id: string;
  runId: string;
  modelId: string;
  status: ResultStatus;
  output?: { src: string; kind: MediaKind };
  usage?: Usage;
  /** Verdicts from the builder's own backend checks on this output — see `Evaluation`. */
  evaluations?: Evaluation[];
  error?: { message: string; reasons?: string[] };
  /** Set by `startResult` — internal bookkeeping for `durationMs`, not meant to be read directly by a consumer (it's a raw `Date.now()`, not itself a duration). */
  startedAt?: number;
  /** How long this result took from `startResult` to `resolveResult`/`failResult`, in ms — `undefined` if it resolved without ever going through `startResult` (e.g. resolved directly from `"queued"`). ResultCard's info-flip is what actually surfaces this (reference: the Figma mock's "3.03s" chip). */
  durationMs?: number;
}

export interface Run {
  id: string;
  request: Request;
  createdAt: number;
  results: Result[];
}

/**
 * A result's `modelId` while auto-select is still choosing the model: the
 * run exists from the moment of submit, so a result card can show progress
 * right away. Replaced by the real model once routing finishes.
 */
export const ROUTING_MODEL_ID = "routing";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Fans a `Request` out into one `"queued"` `Result` per model — a run's
 * results all exist from the start, so a caller can render "3 of 4 done"
 * immediately rather than watching the list grow.
 */
export function createRun(request: Request): Run {
  const id = nextId("run");
  return {
    id,
    request,
    createdAt: Date.now(),
    results: request.modelIds.map((modelId) => ({
      id: nextId("result"),
      runId: id,
      modelId,
      status: "queued",
    })),
  };
}

function updateResult(run: Run, resultId: string, fn: (result: Result) => Result): Run {
  return { ...run, results: run.results.map((r) => (r.id === resultId ? fn(r) : r)) };
}

export function startResult(run: Run, resultId: string): Run {
  return updateResult(run, resultId, (r) => ({ ...r, status: "running", startedAt: Date.now() }));
}

/**
 * Folds partial streamed text into a running result: `output` fills in
 * while `status` stays `"running"`, so "running with output" is what a
 * streaming result looks like. A no-op once the result has settled, so a
 * late chunk can't overwrite a final `resolveResult`/`failResult`.
 */
export function streamResult(run: Run, resultId: string, textSoFar: string): Run {
  return updateResult(run, resultId, (r) =>
    r.status === "running" ? { ...r, output: { src: textSoFar, kind: "text" } } : r
  );
}

export function resolveResult(
  run: Run,
  resultId: string,
  output: Result["output"],
  usage?: Usage,
  evaluations?: Evaluation[]
): Run {
  return updateResult(run, resultId, (r) => ({
    ...r,
    status: "done",
    output,
    usage,
    evaluations,
    durationMs: r.startedAt != null ? Date.now() - r.startedAt : undefined,
  }));
}

export function failResult(run: Run, resultId: string, error: Result["error"]): Run {
  return updateResult(run, resultId, (r) => ({
    ...r,
    status: "error",
    error,
    durationMs: r.startedAt != null ? Date.now() - r.startedAt : undefined,
  }));
}

/** Marks a queued or running result as stopped by the person. A settled result is left as it is. */
export function cancelResult(run: Run, resultId: string): Run {
  return updateResult(run, resultId, (r) =>
    r.status === "queued" || r.status === "running"
      ? { ...r, status: "cancelled", durationMs: r.startedAt != null ? Date.now() - r.startedAt : undefined }
      : r
  );
}

/**
 * Derives a `GenerationUseCase` from Composer's own `{ kind, label }` use
 * case plus whether anything is attached — this is real derivation logic,
 * not just plumbing: the same `kind: "video"` means `"text-to-video"` with
 * nothing attached but `"image-to-video"` once an image is. Returns
 * `undefined` for "audio" (no `GenerationUseCase` member exists yet;
 * audio generation is planned). `"text"` is a text request: a reply to
 * the prompt, or a description of the attached media ("vision").
 */
export function deriveGenerationUseCase(
  useCase: { kind: MediaKind } | null | undefined,
  attachments: DroppedMedia[]
): GenerationUseCase | undefined {
  if (!useCase) return undefined;
  const hasMedia = attachments.length > 0;
  if (useCase.kind === "video") return hasMedia ? "image-to-video" : "text-to-video";
  if (useCase.kind === "image") return hasMedia ? "image-edit" : "text-to-image";
  if (useCase.kind === "text") return hasMedia ? "vision" : "text-to-text";
  return undefined;
}
