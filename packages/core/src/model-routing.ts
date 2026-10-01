/**
 * Auto-select model routing: a reasoning model reads the request and picks
 * one model from the builder's own list. The instruction is plain English
 * in `buildModelRoutingPrompt` below, so tuning it is just editing text;
 * pass your own builder to the hooks' `routingPrompt` option to replace it.
 */

import { normalizeGenerationError, type GenerationEngine } from "./engine.js";
import type { DroppedMedia, MediaKind, ModelOption } from "./types.js";

export interface ModelRoutingInput {
  /** What the person typed. Empty for media-only requests (e.g. Media Analyzer). */
  prompt: string;
  /** What the request produces, e.g. "image" for Create image, "text" for analysis. */
  outputKind: MediaKind;
  /** Kinds of media attached, if any. */
  attachmentKinds: MediaKind[];
  /** The candidates: only models the builder offers for this request. */
  models: ModelOption[];
}

export function buildModelRoutingPrompt({ prompt, outputKind, attachmentKinds, models }: ModelRoutingInput): string {
  const roster = models.map((m) => `- ${m.id}: ${m.label} (${m.provider}, ${m.speed})`).join("\n");
  const attached = attachmentKinds.length ? attachmentKinds.join(", ") : "none";
  const request = prompt.trim() ? prompt.trim() : "(no text; the attached media is the request)";
  return [
    `Pick the one model best suited to this request. The output is ${outputKind}.`,
    `Weigh what the request needs (subject, detail, style, length, attached media) against each model's strengths. Prefer a faster model when the request is simple.`,
    ``,
    `Request: ${request}`,
    `Attached media: ${attached}`,
    ``,
    `Models:`,
    roster,
    ``,
    `Reply with only the chosen model id, exactly as written above, and nothing else.`,
  ].join("\n");
}

/** Finds the model id in a reasoning model's reply, or `undefined` if it named none of `models`. */
export function parseModelRoutingReply(reply: string, models: ModelOption[]): string | undefined {
  const cleaned = reply.trim().replace(/^[`"'*\s]+|[`"'*.\s]+$/g, "");
  const exact = models.find((m) => m.id === cleaned);
  if (exact) return exact.id;
  // A chatty reply ("I'd pick openai/gpt-5.2 because…"): take the longest
  // id it contains, so "x/model-pro" wins over its prefix "x/model".
  return [...models].sort((a, b) => b.id.length - a.id.length).find((m) => reply.includes(m.id))?.id;
}

export type ModelRoutingResult =
  | { status: "routed"; modelId: string }
  | {
      status: "fallback";
      modelId: string;
      reason: "no-reasoning" | "request-failed" | "invalid-reply";
      /** The provider's own message when the reasoning call failed. */
      error?: string;
    };

export interface RouteModelArgs extends ModelRoutingInput {
  /** The reasoning engine and model. Omit both and routing falls back without a call. */
  engine?: GenerationEngine;
  model?: string;
  attachments?: DroppedMedia[];
  /** Replaces `buildModelRoutingPrompt`. */
  routingPrompt?: (input: ModelRoutingInput) => string;
  /** Stops the reasoning call; the result is then a `"request-failed"` fallback. */
  signal?: AbortSignal;
}

/**
 * Asks the reasoning model to pick from `models`. Never throws: when it
 * can't route (no reasoning model, a failed call, an answer not in the
 * list) it falls back to the first listed model and says why, so a
 * routing problem never blocks the request itself.
 */
export async function routeModel(args: RouteModelArgs): Promise<ModelRoutingResult> {
  const fallback = args.models[0]?.id;
  if (!fallback) throw new Error("routeModel: `models` is empty; there's nothing to pick from.");
  if (args.models.length === 1) return { status: "routed", modelId: fallback };
  if (!args.engine || !args.model) return { status: "fallback", modelId: fallback, reason: "no-reasoning" };

  const input: ModelRoutingInput = {
    prompt: args.prompt,
    outputKind: args.outputKind,
    attachmentKinds: args.attachmentKinds,
    models: args.models,
  };
  try {
    const { src } = await args.engine.generate({
      modelId: args.model,
      prompt: (args.routingPrompt ?? buildModelRoutingPrompt)(input),
      // The media itself helps (e.g. a photo needing an edit-capable model).
      attachments: args.attachments ?? [],
      signal: args.signal,
    });
    const picked = parseModelRoutingReply(src, args.models);
    return picked
      ? { status: "routed", modelId: picked }
      : { status: "fallback", modelId: fallback, reason: "invalid-reply" };
  } catch (err) {
    return { status: "fallback", modelId: fallback, reason: "request-failed", error: normalizeGenerationError(err).message };
  }
}
