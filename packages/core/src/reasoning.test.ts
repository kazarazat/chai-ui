import { describe, expect, it, vi } from "vitest";
import {
  createReasoning,
  DEFAULT_REASONING_MODEL,
  DEFAULT_REASONING_MODEL_BY_KIND,
  pickReasoning,
  reasoningEngineFor,
  reasoningModelFor,
} from "./reasoning.js";

const engine = { generate: vi.fn() };

describe("createReasoning", () => {
  it("defaults to the suggested models", () => {
    const r = createReasoning({}, engine);
    expect(r.model).toBe(DEFAULT_REASONING_MODEL);
    expect(r.modelByKind).toEqual(DEFAULT_REASONING_MODEL_BY_KIND);
  });

  it("merges per-kind overrides over the defaults one kind at a time", () => {
    const r = createReasoning({ reasoningModelByKind: { video: "qwen/qwen3.8-omni-flash", audio: undefined } }, engine);
    expect(r.modelByKind.video).toBe("qwen/qwen3.8-omni-flash");
    expect(r.modelByKind.audio).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
  });
});

describe("reasoningEngineFor", () => {
  it("uses the engine passed, else creates OpenRouter's without calling anything", () => {
    expect(reasoningEngineFor({ reasoningEngine: engine })).toBe(engine);
    expect(reasoningEngineFor({}).generate).toBeInstanceOf(Function);
  });
});

describe("pickReasoning", () => {
  const provided = createReasoning({}, engine);
  it("uses the provider's without an own pair", () => {
    expect(pickReasoning({}, provided)).toBe(provided);
  });
  it("an own pair wins, for every kind", () => {
    expect(pickReasoning({ reasoningEngine: engine, reasoningModel: "m" }, provided)).toEqual({ engine, model: "m", modelByKind: {} });
  });
  it("half a pair never borrows the provider's other half", () => {
    expect(pickReasoning({ reasoningModel: "m" }, provided)).toBeUndefined();
  });
});

describe("reasoningModelFor", () => {
  const reasoning = { engine, model: "claude", modelByKind: { video: "gemini", audio: "gemini" } };
  it("uses the base model for text and images", () => {
    expect(reasoningModelFor(reasoning)).toBe("claude");
    expect(reasoningModelFor(reasoning, [{ src: "x", kind: "image" }])).toBe("claude");
  });
  it("routes to the first attachment kind with its own model", () => {
    expect(reasoningModelFor(reasoning, [{ src: "x", kind: "image" }, { src: "y", kind: "audio" }])).toBe("gemini");
  });
});
