/**
 * A pluggable generation engine — the one interface every model provider
 * (`createFalEngine`, `createOpenRouterEngine`, `mockEngine`, or your own)
 * implements, and the one `useComposer` calls. One call = one model run:
 * a prompt plus any attached media in, one piece of output back.
 *
 * `mockEngine` stands in for a real model API during prototyping: it
 * "generates" a small deterministic placeholder image without any network
 * call or API key. Swap in a real engine without touching any component —
 * that's the whole point of keeping this behind an interface.
 */

import type { DroppedMedia, Evaluation, MediaKind, Usage } from "./types.js";

export interface GenerationEngine {
  generate(args: {
    /**
     * The model the person picked. An engine uses it when set and falls
     * back to its own configured default when it isn't.
     */
    modelId?: string;
    prompt: string;
    attachments: DroppedMedia[];
    /** The output aspect ratio the person picked, e.g. `"16:9"`. Only set for a model that lists it in `ModelOption.aspectRatios`. */
    aspectRatio?: string;
    /**
     * Optional streaming hook for text output. An engine that can stream
     * calls this with the full text received so far (not a delta) each time
     * more arrives; one that can't simply never calls it. The returned
     * promise's value is still the authoritative final output.
     */
    onText?: (textSoFar: string) => void;
    /**
     * Aborted when the person stops the request. An engine that can cancel
     * at the provider does so, then rejects with an `AbortError` (see
     * `abortError`). Cancellation is best effort: some providers keep
     * running, and billing, once a request has started.
     */
    signal?: AbortSignal;
  }): Promise<{ src: string; kind: MediaKind; usage?: Usage; evaluations?: Evaluation[] }>;
}

/** The error an engine rejects with when its `signal` was aborted. */
export function abortError(): Error {
  return new DOMException("The request was cancelled.", "AbortError");
}

/** True for an `AbortError`, the way an engine reports a cancelled call. */
export function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

/** Resolves after `ms`, or rejects with an `AbortError` as soon as `signal` aborts. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Thrown by a `GenerationEngine` to fail a call with structured,
 * user-facing content — `reasons` can render as a bullet list, `message`
 * alone as a single sentence. A real engine should unwrap its provider's
 * specific error into this shape rather than let a bare network/HTTP error
 * reach the UI.
 */
export class GenerationError extends Error {
  reasons?: string[];
  constructor(message: string, reasons?: string[]) {
    super(message);
    this.name = "GenerationError";
    this.reasons = reasons;
  }
}

/**
 * Reads the top-level `evaluations` field a builder's backend proxy
 * appended to a provider response, the convention both built-in engines
 * follow. Malformed entries are dropped rather than rendered as verdicts
 * nobody actually returned.
 */
export function readEvaluations(json: unknown): Evaluation[] | undefined {
  const raw = (json as { evaluations?: unknown } | null)?.evaluations;
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter(
    (e): e is Evaluation =>
      !!e && typeof e.id === "string" && typeof e.label === "string" && typeof e.passed === "boolean"
  );
  return valid.length ? valid.map(({ id, label, passed }) => ({ id, label, passed })) : undefined;
}

/** Turns anything an engine threw into the `{ message, reasons }` shape a `Result`'s `error` holds. */
export function normalizeGenerationError(err: unknown): { message: string; reasons?: string[] } {
  if (err instanceof GenerationError) {
    return { message: err.message, reasons: err.reasons };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Something went wrong. Please try again." };
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function placeholderSvg(seed: string, caption: string): string {
  const h = hash(seed);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 55% 38%)" />
      <stop offset="100%" stop-color="hsl(${hue2} 60% 24%)" />
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)" />
  <text x="24" y="332" font-family="ui-monospace, monospace" font-size="13" fill="rgba(255,255,255,0.85)">${escapeXml(
    caption
  )}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        c
      ] ?? c
  );
}

/**
 * A plausible text reply for a text-output mock (e.g. standing in for a
 * reasoning/vision model) — still not a real model call, just a more
 * honest stand-in than a gradient image would be.
 */
function mockText(prompt: string, modelId: string): string {
  const stylePhrases = [
    "warm, diffused daylight",
    "a shallow depth of field",
    "muted, desaturated tones",
    "a centered, symmetrical composition",
    "soft shadows and high contrast",
  ];
  const subjectPhrases = [
    "a single object resting on a plain surface",
    "a figure positioned slightly off-center",
    "an outdoor scene with layered depth",
    "a close-up study of texture and material",
  ];
  const style = stylePhrases[hash(modelId + "style") % stylePhrases.length];
  const subject = subjectPhrases[hash(modelId + "subject") % subjectPhrases.length];
  const detail = prompt.includes("detailed")
    ? " Rendered here with extra material and lighting detail, per the requested length."
    : "";
  return `${subject}, shot with ${style}.${detail} (mock — ${modelId})`;
}

/**
 * A plausible, deterministic-per-call token/cost fabrication, so a demo can
 * show usage without a real tokenizer or pricing API. `costUsd` uses an
 * illustrative, not verified, rate — a real engine should only ever report
 * a cost it actually derived from real pricing.
 */
function mockUsage(seed: string): Usage {
  const promptTokens = 180 + (hash(seed + "prompt") % 420);
  const completionTokens = 40 + (hash(seed + "completion") % 260);
  const illustrativeRatePerMillion = { input: 0.15, output: 0.6 };
  const costUsd =
    (promptTokens * illustrativeRatePerMillion.input +
      completionTokens * illustrativeRatePerMillion.output) /
    1_000_000;
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, costUsd };
}

export interface MockEngineOptions {
  /** What the mock "generates". Defaults to "image" (a placeholder gradient); "text" returns a plausible text reply instead. */
  outputKind?: "image" | "text";
  /**
   * Fraction of calls that fail with `GenerationError`, 0-1. Default 0 —
   * pass 1 to force every call to fail (a UI-testing convenience for
   * previewing error states on demand).
   */
  failureRate?: number;
}

let mockCallCount = 0;

export function createMockEngine(options: MockEngineOptions = {}): GenerationEngine {
  const outputKind = options.outputKind ?? "image";
  const failureRate = options.failureRate ?? 0;
  return {
    async generate({ modelId = "mock-model", prompt, onText, signal }) {
      mockCallCount += 1;
      const seed = `${modelId}:${prompt}:${mockCallCount}`;
      await abortableSleep(500 + (hash(seed) % 1200), signal);

      if (failureRate > 0 && (hash(seed) % 100) / 100 < failureRate) {
        throw new GenerationError("Generation failed", [
          "The model could not complete this request.",
          "Try again, or select a different model.",
        ]);
      }

      if (outputKind === "text") {
        const text = mockText(prompt, modelId);
        if (onText) {
          // Word by word, so a streaming UI has something real to render.
          const words = text.split(" ");
          for (let i = 1; i <= words.length; i++) {
            onText(words.slice(0, i).join(" "));
            await abortableSleep(60, signal);
          }
        }
        return { src: text, kind: "text", usage: mockUsage(seed) };
      }
      const caption = `${modelId} · ${prompt.slice(0, 48)}${prompt.length > 48 ? "…" : ""}`;
      return { src: placeholderSvg(`${modelId}:${prompt}`, caption), kind: "image", usage: mockUsage(seed) };
    },
  };
}

export const mockEngine: GenerationEngine = createMockEngine();
