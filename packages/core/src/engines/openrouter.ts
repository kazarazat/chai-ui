/**
 * A real text/reasoning `GenerationEngine` backed by OpenRouter
 * (openrouter.ai) — a fully-supported alternative to the default Fal.ai
 * (see the Develop page's "Model providers" section). Returns text: prompt
 * enhancement, media analysis (vision/video/audio understanding), and any
 * other text-out call.
 *
 * Security: this engine never sees an API key and never calls
 * `openrouter.ai` directly. It POSTs to a same-origin `endpoint` (default
 * `/api/chai/openrouter/chat`, served by `createChaiHandler`) that a server-side proxy owns — the proxy is the
 * only thing that reads `OPENROUTER_API_KEY` and attaches the
 * `Authorization` header. Passing a key into this file would put it in the
 * browser bundle; don't add one.
 */

import { readEvaluations, type GenerationEngine } from "../engine.js";
import type { DroppedMedia, Evaluation, MediaKind, Usage } from "../types.js";

export interface OpenRouterEngineOptions {
  /** Same-origin proxy path that attaches the real key server-side. */
  endpoint?: string;
  /** OpenRouter model id (e.g. "google/gemini-2.5-flash"), used when the caller passes no `modelId` and no `modelByKind` entry matches. */
  model?: string;
  /** Per-attached-media-kind model override, e.g. a vision model for images and a different one for audio. */
  modelByKind?: Partial<Record<MediaKind, string>>;
  /**
   * Cap on the model's response length. Required in practice, not just
   * cost hygiene: some providers/models reject a request with no cap at
   * all (defaulting to their max, e.g. 65535) once it exceeds the
   * account's available credits, rather than just truncating. Defaults to
   * a one-paragraph-ish budget — enough for a "detailed" seed-prompt
   * description.
   */
  maxTokens?: number;
  /**
   * USD per million tokens for whichever model this engine calls, if you
   * want a real cost figure on the returned `usage` instead of just token
   * counts. Deliberately not defaulted to anything: OpenRouter's real
   * per-model pricing isn't tracked anywhere in this repo, and a guessed
   * number would be worse than an honestly absent cost. Pull the real rate
   * from OpenRouter's `/models` endpoint or your own account dashboard and
   * pass it here if you want `usage.costUsd` populated.
   */
  pricePerMillionTokens?: { input: number; output: number };
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_MAX_TOKENS = 800;

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  // OpenAI-compatible shape OpenRouter itself uses; absent on some
  // providers routed through it, hence all-optional.
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  // `metadata.raw` carries the upstream provider's own JSON error as a
  // string when OpenRouter's own `message` is just a generic wrapper (e.g.
  // "Provider returned error") — seen live when Google AI Studio rejected
  // a malformed image with a much more specific "Provided image is not
  // valid" underneath.
  error?: { message?: string; metadata?: { raw?: string } };
}

/** Converts OpenRouter's raw `usage` into `Usage`, computing `costUsd` only when a real rate was supplied. */
function toUsage(
  usage: ChatCompletionResponse["usage"],
  pricePerMillionTokens?: { input: number; output: number }
): Usage | undefined {
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const costUsd = pricePerMillionTokens
    ? (promptTokens * pricePerMillionTokens.input +
        completionTokens * pricePerMillionTokens.output) /
      1_000_000
    : undefined;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
    costUsd,
  };
}

/** Prefers the upstream provider's own error message over OpenRouter's generic wrapper, when both are present. */
function describeError(json: ChatCompletionResponse, fallback: string): string {
  const base = json.error?.message ?? fallback;
  const raw = json.error?.metadata?.raw;
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message && parsed.error.message !== base) {
      return `${base} — ${parsed.error.message}`;
    }
  } catch {
    // Not JSON; the generic message is all we have.
  }
  return base;
}

/** Builds the one non-text content part for an attached image/video/audio file. */
export function contentPartForMedia(media: DroppedMedia): ChatContentPart {
  if (media.kind === "video") {
    return { type: "video_url", video_url: { url: media.src } };
  }
  if (media.kind === "audio") {
    // OpenRouter's input_audio wants raw base64 + a format string, not a
    // data: URL — audio can't be passed by URL at all per OpenRouter docs.
    const match = /^data:audio\/(\w+);base64,(.+)$/.exec(media.src);
    if (!match) {
      throw new Error(
        "openRouterEngine: audio media must be a base64 data URL (data:audio/<format>;base64,...)"
      );
    }
    return { type: "input_audio", input_audio: { data: match[2]!, format: match[1]! } };
  }
  return { type: "image_url", image_url: { url: media.src } };
}

/** Builds the OpenRouter chat-completions request body for a prompt plus any attached media. */
export function buildChatRequest(args: {
  model: string;
  prompt: string;
  media?: DroppedMedia[];
  maxTokens?: number;
}): {
  model: string;
  messages: { role: "user"; content: ChatContentPart[] }[];
  max_tokens: number;
} {
  const content: ChatContentPart[] = [{ type: "text", text: args.prompt }];
  for (const media of args.media ?? []) content.push(contentPartForMedia(media));
  return {
    model: args.model,
    messages: [{ role: "user", content }],
    max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string } }[];
  usage?: ChatCompletionResponse["usage"];
  error?: ChatCompletionResponse["error"];
}

/**
 * Reads an OpenRouter server-sent-events stream (`stream: true`), calling
 * `onText` with the accumulated reply as each chunk lands. Handles the
 * `: OPENROUTER PROCESSING` keep-alive comments and the `[DONE]` sentinel,
 * and still works if a proxy buffered the whole stream into one body.
 */
export async function readChatStream(
  res: Response,
  onText: (textSoFar: string) => void
): Promise<{ text: string; usage?: ChatCompletionResponse["usage"]; evaluations?: Evaluation[] }> {
  let text = "";
  let usage: ChatCompletionResponse["usage"];
  let evaluations: Evaluation[] | undefined;
  let buffer = "";

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return; // blank separators and ": keep-alive" comments
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: ChatCompletionChunk;
    try {
      chunk = JSON.parse(data) as ChatCompletionChunk;
    } catch {
      return;
    }
    if (chunk.error) {
      throw new Error(`openRouterEngine: ${describeError({ error: chunk.error }, "stream error")}`);
    }
    if (chunk.usage) usage = chunk.usage;
    // A backend that checks the output appends its verdicts as their own chunk.
    evaluations = readEvaluations(chunk) ?? evaluations;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      text += delta;
      onText(text);
    }
  };

  const drain = (final: boolean) => {
    const lines = buffer.split("\n");
    buffer = final ? "" : lines.pop()!;
    for (const line of lines) handleLine(line.trimEnd());
  };

  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain(false);
    }
    buffer += decoder.decode();
  } else {
    buffer = await res.text();
  }
  drain(true);
  return { text, usage, evaluations };
}

/**
 * Sends the prompt plus every attached file to OpenRouter via the local
 * proxy and returns the model's reply as `"text"`. Calls the caller's
 * `modelId` when given, otherwise `modelByKind` (keyed on the first
 * attachment's kind), `model`, or the built-in default. Streams (OpenRouter's
 * `stream: true`) when the caller passes `onText`; the proxy must pass the
 * response body through rather than buffer it for that to be incremental.
 */
export function createOpenRouterEngine(
  options: OpenRouterEngineOptions = {}
): GenerationEngine {
  const endpoint = options.endpoint ?? "/api/chai/openrouter/chat";
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async generate({ modelId, prompt, attachments, onText, signal }) {
      const firstKind = attachments[0]?.kind;
      const model =
        modelId || (firstKind && options.modelByKind?.[firstKind]) || options.model || DEFAULT_MODEL;
      const body = buildChatRequest({ model, prompt, media: attachments, maxTokens: options.maxTokens });

      // Aborting closes the connection. On a stream, OpenRouter then stops
      // the model and billing for providers that support it; a
      // non-streaming request keeps running at the provider.
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onText ? { ...body, stream: true } : body),
        signal,
      });

      // A rejected request comes back as plain JSON even when streaming was
      // asked for, so only a successful response is read as a stream.
      if (onText && res.ok) {
        const { text, usage, evaluations } = await readChatStream(res, onText);
        if (!text) throw new Error("openRouterEngine: empty response from OpenRouter");
        return { src: text, kind: "text", usage: toUsage(usage, options.pricePerMillionTokens), evaluations };
      }

      const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
      if (!res.ok || json.error) {
        throw new Error(
          `openRouterEngine: ${describeError(json, `${res.status} ${res.statusText}`)}`
        );
      }
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error("openRouterEngine: empty response from OpenRouter");
      return {
        src: text,
        kind: "text",
        usage: toUsage(json.usage, options.pricePerMillionTokens),
        evaluations: readEvaluations(json),
      };
    },
  };
}

/**
 * A minimal, cheap connectivity check — the "use real inference sparingly"
 * path. Deliberately not a `GenerationEngine` and not exercised by any
 * automated test: it's meant to be triggered once, by a person, from the
 * Develop page's "Test connection" button.
 */
export async function pingOpenRouter(
  options: { endpoint?: string; model?: string; fetchImpl?: typeof fetch } = {}
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const endpoint = options.endpoint ?? "/api/chai/openrouter/chat";
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly one word: OK." }],
        max_tokens: 5,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
    if (!res.ok || json.error) {
      return { ok: false, error: describeError(json, `${res.status} ${res.statusText}`) };
    }
    return { ok: true, reply: json.choices?.[0]?.message?.content?.trim() ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
