/**
 * A real `GenerationEngine` backed by Fal.ai (fal.ai) — CHAI's default
 * model marketplace as of 2026-09-24, chosen for the
 * text/image-to-video and audio-generation coverage OpenRouter lacks.
 * OpenRouter remains a fully-supported alternative, not deprecated by
 * this — see the Develop page's "Model providers" section.
 *
 * Handles media generation only: produces real image/video media via Fal's
 * queue API (submit → poll → fetch result). Fal's own vision/LLM access
 * (`any-llm`, `any-llm/vision`) is itself a proxy in front of OpenRouter,
 * not an independent catalog — for text/reasoning calls
 * (e.g. prompt enhancement, media analysis) use `createOpenRouterEngine`
 * instead of routing through Fal to OpenRouter.
 *
 * Security: this engine never sees an API key and never calls
 * `queue.fal.run` directly. It calls a same-origin `endpoint` (default
 * `/api/chai/fal`, served by `createChaiHandler`) that a server-side proxy owns and mirrors Fal's own queue
 * URL shape (`/{model}`, `/{model}/requests/{id}/status`,
 * `/{model}/requests/{id}`) — the proxy is the only thing that reads
 * `FAL_KEY` and attaches the `Authorization: Key ...` header. Passing a
 * key into this file would put it in the browser bundle; don't add one.
 */

import { abortError, abortableSleep, isAbortError, readEvaluations, type GenerationEngine } from "../engine.js";
import type { DroppedMedia, MediaKind } from "../types.js";

/** Output kinds this engine can produce — text goes through a reasoning engine instead (see file doc comment). */
type FalOutputKind = Exclude<MediaKind, "text">;

export interface FalEngineOptions {
  /** Same-origin proxy path that attaches the real key server-side and mirrors Fal's queue URL shape. */
  endpoint?: string;
  /** Fal model id to call when the caller passes no `modelId` and no `modelByKind` entry matches `outputKind`. */
  model?: string;
  /** Per-output-kind Fal model id override — e.g. `{ image: "fal-ai/flux/schnell", video: "minimax/h3-max/text-to-video" }`. */
  modelByKind?: Partial<Record<FalOutputKind, string>>;
  /** Which kind of media this engine instance produces. Defaults to "image". */
  outputKind?: FalOutputKind;
  /** Poll interval while a queued job is in progress. Defaults to 1500ms. */
  pollIntervalMs?: number;
  /** Give up waiting after this long. Defaults to 120000ms (2 min) — video/audio jobs run longer than image ones. */
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Fal model ids verified live against fal.ai's own docs/catalog
 * 2026-09-24, not invented. No default for "audio": CHAI has no audio
 * `GenerationUseCase` yet, so guessing one
 * here would be ahead of any real use case that needs it.
 */
const DEFAULT_MODEL_BY_KIND: Partial<Record<FalOutputKind, string>> = {
  image: "fal-ai/flux/schnell",
  video: "minimax/h3-max/text-to-video",
};

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 120_000;

interface FalSubmitResponse {
  request_id?: string;
  status?: string;
  error?: unknown;
  detail?: unknown;
}

interface FalStatusResponse {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string;
  error?: unknown;
  detail?: unknown;
}

interface FalResultResponse {
  images?: { url: string }[];
  video?: { url: string };
  audio?: { url: string };
  audio_url?: string;
  error?: unknown;
  detail?: unknown;
}


/** Fal's error shape varies by failure type — validation errors carry `detail`, job failures carry `error`. Prefer whichever is present and stringify a non-string one. */
export function describeFalError(json: { error?: unknown; detail?: unknown }, fallback: string): string {
  const raw = json.error ?? json.detail;
  if (!raw) return fallback;
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return fallback;
  }
}

/** Builds the one Fal request body CHAI sends — a prompt, plus an `image_url` when an attached image is available (for image-to-video / edit-shaped models). */
export function buildFalRequestBody(args: {
  prompt: string;
  media?: DroppedMedia;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: args.prompt };
  if (args.media?.kind === "image") body.image_url = args.media.src;
  return body;
}

/** Pulls the generated media URL out of Fal's result JSON for the given output kind — the response shape differs by modality. */
export function extractFalResultSrc(json: FalResultResponse, kind: FalOutputKind): string | undefined {
  if (kind === "image") return json.images?.[0]?.url;
  if (kind === "video") return json.video?.url;
  return json.audio?.url ?? json.audio_url;
}

async function submitFalJob(args: {
  endpoint: string;
  model: string;
  body: Record<string, unknown>;
  fetchImpl: typeof fetch;
}): Promise<{ requestId: string; status: string }> {
  const res = await args.fetchImpl(`${args.endpoint}/${args.model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.body),
  });
  const json = (await res.json().catch(() => ({}))) as FalSubmitResponse;
  if (!res.ok || json.error) throw new Error(describeFalError(json, `${res.status} ${res.statusText}`));
  if (!json.request_id) throw new Error("submit response had no request_id");
  return { requestId: json.request_id, status: json.status ?? "IN_QUEUE" };
}

/** Polls a submitted job's status until `COMPLETED`, then fetches and returns its result. */
async function awaitFalJob(args: {
  endpoint: string;
  model: string;
  requestId: string;
  status: string;
  fetchImpl: typeof fetch;
  pollIntervalMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<FalResultResponse> {
  let status = args.status;
  const deadline = Date.now() + args.timeoutMs;
  while (status !== "COMPLETED") {
    if (Date.now() > deadline) {
      throw new Error(`timed out after ${args.timeoutMs}ms waiting for the job to complete`);
    }
    await abortableSleep(args.pollIntervalMs, args.signal);
    const res = await args.fetchImpl(`${args.endpoint}/${args.model}/requests/${args.requestId}/status`);
    const json = (await res.json().catch(() => ({}))) as FalStatusResponse;
    if (!res.ok || json.error) throw new Error(describeFalError(json, `${res.status} ${res.statusText}`));
    status = json.status ?? status;
  }
  const res = await args.fetchImpl(`${args.endpoint}/${args.model}/requests/${args.requestId}`);
  const json = (await res.json().catch(() => ({}))) as FalResultResponse;
  if (!res.ok || json.error) throw new Error(describeFalError(json, `${res.status} ${res.statusText}`));
  return json;
}

/**
 * Asks Fal to drop a job (`PUT …/requests/<id>/cancel`). A queued job is
 * removed and never runs; a running one gets a cancel signal and may still
 * finish, depending on the model. Best effort: a failed cancel call is
 * ignored, since the person has already stopped waiting.
 */
async function cancelFalJob(args: { endpoint: string; model: string; requestId: string; fetchImpl: typeof fetch }) {
  await args.fetchImpl(`${args.endpoint}/${args.model}/requests/${args.requestId}/cancel`, { method: "PUT" }).catch(() => {});
}

/**
 * A media-generation `GenerationEngine` — submits the prompt (plus the
 * first attached image, if any) to Fal's queue API and polls until the job
 * completes, returning the real generated `src` URL. Calls the caller's
 * `modelId` when given, otherwise `modelByKind`/`model`/the built-in default.
 */
export function createFalEngine(options: FalEngineOptions = {}): GenerationEngine {
  const endpoint = options.endpoint ?? "/api/chai/fal";
  // Called through a wrapper, never as `args.fetchImpl(...)`: browsers throw
  // "Illegal invocation" when fetch runs with an object as `this`.
  const fetchImpl: typeof fetch = (input, init) => (options.fetchImpl ?? fetch)(input, init);
  const outputKind = options.outputKind ?? "image";
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async generate({ modelId, prompt, attachments, signal }) {
      const model =
        modelId ?? options.modelByKind?.[outputKind] ?? options.model ?? DEFAULT_MODEL_BY_KIND[outputKind];
      if (!model) {
        throw new Error(
          `falEngine: no model configured for outputKind "${outputKind}" — pass \`model\` or \`modelByKind.${outputKind}\`.`
        );
      }

      const body = buildFalRequestBody({ prompt, media: attachments[0] });
      if (signal?.aborted) throw abortError();

      try {
        // The submit itself isn't aborted mid-flight: without its request id
        // there'd be nothing to cancel at Fal.
        const { requestId, status } = await submitFalJob({ endpoint, model, body, fetchImpl });
        if (signal?.aborted) {
          await cancelFalJob({ endpoint, model, requestId, fetchImpl });
          throw abortError();
        }
        const result = await awaitFalJob({
          endpoint,
          model,
          requestId,
          status,
          fetchImpl,
          pollIntervalMs,
          timeoutMs,
          signal,
        }).catch(async (err) => {
          if (isAbortError(err)) await cancelFalJob({ endpoint, model, requestId, fetchImpl });
          throw err;
        });
        const src = extractFalResultSrc(result, outputKind);
        if (!src) throw new Error(`no ${outputKind} output in Fal's response`);
        // No `usage`: Fal bills per generation, not per token — `Usage`
        // is token-shaped (promptTokens/completionTokens), and fabricating
        // token counts to fit it would be a worse guess than reporting
        // nothing, per the same rule `openrouter.ts`'s
        // `pricePerMillionTokens` comment documents for cost.
        return { src, kind: outputKind, evaluations: readEvaluations(result) };
      } catch (err) {
        if (isAbortError(err)) throw err;
        throw new Error(`falEngine: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

/**
 * A minimal, cheap connectivity check against Fal's fastest image model —
 * the "use real inference sparingly" path, same role as `pingOpenRouter`.
 * Deliberately not a `GenerationEngine` and not exercised by any automated
 * test: meant to be triggered once, by a person, from the Develop page's
 * "Test connection" button.
 */
export async function pingFal(
  options: { endpoint?: string; model?: string; fetchImpl?: typeof fetch } = {}
): Promise<{ ok: true; src: string } | { ok: false; error: string }> {
  const endpoint = options.endpoint ?? "/api/chai/fal";
  // Called through a wrapper, never as `args.fetchImpl(...)`: browsers throw
  // "Illegal invocation" when fetch runs with an object as `this`.
  const fetchImpl: typeof fetch = (input, init) => (options.fetchImpl ?? fetch)(input, init);
  const model = options.model ?? DEFAULT_MODEL_BY_KIND.image!;
  try {
    const { requestId, status } = await submitFalJob({
      endpoint,
      model,
      body: buildFalRequestBody({ prompt: "a single red circle on a white background" }),
      fetchImpl,
    });
    const result = await awaitFalJob({
      endpoint,
      model,
      requestId,
      status,
      fetchImpl,
      pollIntervalMs: 1000,
      timeoutMs: 30_000,
    });
    const src = extractFalResultSrc(result, "image");
    if (!src) return { ok: false, error: "no image output in Fal's response" };
    return { ok: true, src };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
