/**
 * A `GenerationEngine` backed by Vercel's AI Gateway (vercel.com/docs/ai-gateway)
 * — one OpenAI-compatible endpoint in front of 200+ models from many labs.
 * Covers text/reasoning (chat completions, the same wire format as
 * OpenRouter) and image generation (the OpenAI-style images endpoint).
 *
 * Video isn't offered: the gateway's OpenAI-compatible surface has no
 * confirmed video-generation endpoint, so `outputKind: "video"` doesn't
 * exist here. Use `createFalEngine` for video.
 *
 * Security: this engine never sees an API key and never calls
 * `ai-gateway.vercel.sh` directly. It POSTs to a same-origin `endpoint`
 * (default `/api/chai/vercel`, served by `createChaiHandler`), which adds
 * `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN` on Vercel) server-side.
 * Passing a key into this file would put it in the browser bundle; don't
 * add one.
 */

import { readEvaluations, type GenerationEngine } from "../engine.js";
import type { DroppedMedia, Evaluation, Usage } from "../types.js";
import {
  buildChatRequest,
  describeError,
  readChatStream,
  toUsage,
  type ChatCompletionResponse,
} from "./openrouter.js";

/** Output kinds the gateway can produce. Video is excluded: see the file doc comment. */
export type VercelOutputKind = "text" | "image";

export interface VercelEngineOptions {
  /** Same-origin proxy base path; the engine appends `/chat` or `/images`. */
  endpoint?: string;
  /**
   * Gateway model id (e.g. `"anthropic/claude-opus-5"`), used when the
   * caller passes no `modelId` and no `modelByKind` entry matches. There is
   * no built-in default: the gateway catalog changes often, so name the
   * model you want.
   */
  model?: string;
  /** Per-output-kind model override, e.g. a text model and an image model. */
  modelByKind?: Partial<Record<VercelOutputKind, string>>;
  /** Which kind of output this engine instance produces. Defaults to "text". */
  outputKind?: VercelOutputKind;
  /** Cap on a text response's length, as in `createOpenRouterEngine`. */
  maxTokens?: number;
  /** USD per million tokens, if you want `usage.costUsd` populated. Not defaulted, for the same reason as OpenRouter's. */
  pricePerMillionTokens?: { input: number; output: number };
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

interface ImagesResponse extends ChatCompletionResponse {
  data?: { url?: string; b64_json?: string }[];
}

export function createVercelEngine(options: VercelEngineOptions = {}): GenerationEngine {
  const endpoint = (options.endpoint ?? "/api/chai/vercel").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const outputKind = options.outputKind ?? "text";

  return {
    async generate({ modelId, prompt, attachments, onText, signal }) {
      const model = modelId ?? options.modelByKind?.[outputKind] ?? options.model;
      if (!model) {
        throw new Error(
          `vercelEngine: no model configured for outputKind "${outputKind}" — pass \`model\` or \`modelByKind.${outputKind}\`.`
        );
      }

      if (outputKind === "image") {
        if (attachments.length > 0) {
          throw new Error("vercelEngine: image generation takes a prompt only; attachments aren't supported here.");
        }
        return generateImage({ endpoint, fetchImpl, model, prompt, signal });
      }

      return generateText({
        endpoint,
        fetchImpl,
        model,
        prompt,
        attachments,
        onText,
        signal,
        maxTokens: options.maxTokens,
        pricePerMillionTokens: options.pricePerMillionTokens,
      });
    },
  };
}

async function generateText(args: {
  endpoint: string;
  fetchImpl: typeof fetch;
  model: string;
  prompt: string;
  attachments: DroppedMedia[];
  onText?: (textSoFar: string) => void;
  signal?: AbortSignal;
  maxTokens?: number;
  pricePerMillionTokens?: { input: number; output: number };
}): Promise<{ src: string; kind: "text"; usage?: Usage; evaluations?: Evaluation[] }> {
  const body = buildChatRequest({
    model: args.model,
    prompt: args.prompt,
    media: args.attachments,
    maxTokens: args.maxTokens,
  });
  const res = await args.fetchImpl(`${args.endpoint}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.onText ? { ...body, stream: true } : body),
    signal: args.signal,
  });

  // A rejected request comes back as plain JSON even when streaming was asked for.
  if (args.onText && res.ok) {
    const { text, usage, evaluations } = await readChatStream(res, args.onText);
    if (!text) throw new Error("vercelEngine: empty response from the AI Gateway");
    return { src: text, kind: "text", usage: toUsage(usage, args.pricePerMillionTokens), evaluations };
  }

  const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok || json.error) {
    throw new Error(`vercelEngine: ${describeError(json, `${res.status} ${res.statusText}`)}`);
  }
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("vercelEngine: empty response from the AI Gateway");
  return {
    src: text,
    kind: "text",
    usage: toUsage(json.usage, args.pricePerMillionTokens),
    evaluations: readEvaluations(json),
  };
}

/**
 * Image generation through `/v1/images/generations`. The OpenAI images
 * shape returns either a hosted `url` or inline `b64_json`; both come back
 * as a usable `src`. The gateway's image endpoint takes no aspect-ratio
 * field here, so the engine doesn't send one — size is the model's default.
 */
async function generateImage(args: {
  endpoint: string;
  fetchImpl: typeof fetch;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<{ src: string; kind: "image" }> {
  const res = await args.fetchImpl(`${args.endpoint}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: args.model, prompt: args.prompt, n: 1 }),
    signal: args.signal,
  });
  const json = (await res.json().catch(() => ({}))) as ImagesResponse;
  if (!res.ok || json.error) {
    throw new Error(`vercelEngine: ${describeError(json, `${res.status} ${res.statusText}`)}`);
  }
  const item = json.data?.[0];
  const src = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined);
  if (!src) throw new Error("vercelEngine: no image in the AI Gateway's response");
  return { src, kind: "image" };
}

/**
 * A minimal, cheap connectivity check through the same-origin route — the
 * "use real inference sparingly" path. Like `pingOpenRouter` and `pingFal`,
 * it's triggered once by a person from the Develop page's "Test connection"
 * button, never by a test or on mount. It needs a `model` because the
 * gateway has no default.
 */
export async function pingVercel(
  options: { endpoint?: string; model: string; fetchImpl?: typeof fetch }
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const endpoint = (options.endpoint ?? "/api/chai/vercel").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${endpoint}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
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
