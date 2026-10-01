import { describe, expect, it, vi } from "vitest";
import { GenerationError, type GenerationEngine } from "./engine.js";
import { buildModelRoutingPrompt, parseModelRoutingReply, routeModel } from "./model-routing.js";
import type { ModelOption } from "./types.js";

const models: ModelOption[] = [
  { id: "fal-ai/flux", label: "Flux", provider: "fal", speed: "fast" },
  { id: "fal-ai/flux-pro", label: "Flux Pro", provider: "fal", speed: "standard" },
  { id: "google/imagen", label: "Imagen", provider: "google", speed: "slow" },
];
const engine = (generate: GenerationEngine["generate"]): GenerationEngine => ({ generate });
const base = { prompt: "a red mug", outputKind: "image" as const, attachmentKinds: [], models };

describe("buildModelRoutingPrompt", () => {
  it("lists every candidate and the request, and asks for only an id", () => {
    const text = buildModelRoutingPrompt(base);
    for (const m of models) expect(text).toContain(m.id);
    expect(text).toContain("Request: a red mug");
    expect(text).toContain("Attached media: none");
    expect(text).toMatch(/Reply with only the chosen model id/);
  });

  it("describes a media-only request", () => {
    expect(buildModelRoutingPrompt({ ...base, prompt: " ", attachmentKinds: ["video"] })).toContain(
      "Request: (no text; the attached media is the request)"
    );
  });
});

describe("parseModelRoutingReply", () => {
  it("accepts an exact id, with stray quotes or backticks", () => {
    expect(parseModelRoutingReply("fal-ai/flux-pro", models)).toBe("fal-ai/flux-pro");
    expect(parseModelRoutingReply("`google/imagen`\n", models)).toBe("google/imagen");
  });
  it("finds the longest id in a chatty reply", () => {
    expect(parseModelRoutingReply("I'd use fal-ai/flux-pro for detail.", models)).toBe("fal-ai/flux-pro");
  });
  it("returns undefined for a model not in the list", () => {
    expect(parseModelRoutingReply("openai/dall-e", models)).toBeUndefined();
  });
});

describe("routeModel", () => {
  it("routes to the model the reasoning model names", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "google/imagen", kind: "text" });
    const result = await routeModel({ ...base, engine: engine(generate), model: "anthropic/claude-opus-5" });
    expect(result).toEqual({ status: "routed", modelId: "google/imagen" });
    expect(generate.mock.calls[0]![0].modelId).toBe("anthropic/claude-opus-5");
  });

  it("skips the call when there's only one candidate", async () => {
    const generate = vi.fn();
    const result = await routeModel({ ...base, models: [models[0]!], engine: engine(generate), model: "m" });
    expect(result).toEqual({ status: "routed", modelId: "fal-ai/flux" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("falls back to the first model without a reasoning model", async () => {
    expect(await routeModel(base)).toEqual({ status: "fallback", modelId: "fal-ai/flux", reason: "no-reasoning" });
  });

  it("falls back with the provider's message when the call fails, e.g. a bad key", async () => {
    const failing = engine(async () => {
      throw new GenerationError("401 Unauthorized: invalid API key");
    });
    expect(await routeModel({ ...base, engine: failing, model: "m" })).toEqual({
      status: "fallback",
      modelId: "fal-ai/flux",
      reason: "request-failed",
      error: "401 Unauthorized: invalid API key",
    });
  });

  it("falls back when the reply names no listed model", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "Sorry, I can't help.", kind: "text" });
    expect(await routeModel({ ...base, engine: engine(generate), model: "m" })).toMatchObject({
      status: "fallback",
      reason: "invalid-reply",
    });
  });

  it("uses a custom routing prompt", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "fal-ai/flux", kind: "text" });
    await routeModel({ ...base, engine: engine(generate), model: "m", routingPrompt: () => "CUSTOM" });
    expect(generate.mock.calls[0]![0].prompt).toBe("CUSTOM");
  });
});
