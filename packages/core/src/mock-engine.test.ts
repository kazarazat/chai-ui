import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abortableSleep,
  createMockEngine,
  GenerationError,
  isAbortError,
  mockEngine,
  normalizeGenerationError,
} from "./engine.js";

// The mock waits like a real model; fake timers skip the wait.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("createMockEngine", () => {
  it("makes a placeholder image with usage, captioned with the model and prompt", async () => {
    const out = await settle(mockEngine.generate({ modelId: "fal/fast", prompt: "a <red> & 'bold' mug", attachments: [] }));
    expect(out.kind).toBe("image");
    expect(out.src.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const svg = decodeURIComponent(out.src.slice("data:image/svg+xml;utf8,".length));
    // The caption is escaped, so a prompt can't break the SVG.
    expect(svg).toContain("fal/fast · a &lt;red&gt; &amp; &apos;bold&apos; mug");
    expect(out.usage!.totalTokens).toBe(out.usage!.promptTokens + out.usage!.completionTokens);
    expect(out.usage!.costUsd).toBeGreaterThan(0);
  });

  it("shortens a long prompt in the caption", async () => {
    const out = await settle(createMockEngine().generate({ prompt: "x".repeat(80), attachments: [] }));
    expect(decodeURIComponent(out.src)).toContain(`${"x".repeat(48)}…`);
  });

  it("writes text word by word to onText, then returns the whole reply", async () => {
    const seen: string[] = [];
    const out = await settle(
      createMockEngine({ outputKind: "text" }).generate({
        modelId: "llm",
        prompt: "a detailed answer",
        attachments: [],
        onText: (t) => seen.push(t),
      })
    );
    expect(out.kind).toBe("text");
    expect(out.src).toContain("(mock — llm)");
    // "detailed" asks for the longer reply.
    expect(out.src).toContain("extra material and lighting detail");
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.at(-1)).toBe(out.src);
    expect(seen[1]!.startsWith(seen[0]!)).toBe(true);
  });

  it("returns text without streaming when there's no onText", async () => {
    const out = await settle(createMockEngine({ outputKind: "text" }).generate({ prompt: "hi", attachments: [] }));
    expect(out.src).not.toContain("extra material");
  });

  it("fails with reasons when asked to (failureRate 1)", async () => {
    const run = createMockEngine({ failureRate: 1 }).generate({ prompt: "x", attachments: [] });
    const caught = run.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = await caught;
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).reasons).toHaveLength(2);
  });

  it("stops when its signal aborts", async () => {
    const controller = new AbortController();
    const run = mockEngine.generate({ prompt: "x", attachments: [], signal: controller.signal });
    controller.abort();
    await expect(run).rejects.toSatisfy(isAbortError);
  });
});

describe("abortableSleep", () => {
  it("rejects at once when the signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableSleep(1000, controller.signal)).rejects.toSatisfy(isAbortError);
  });

  it("resolves after the wait", async () => {
    await expect(settle(abortableSleep(10))).resolves.toBeUndefined();
  });
});

describe("normalizeGenerationError", () => {
  it("keeps a GenerationError's message and reasons", () => {
    expect(normalizeGenerationError(new GenerationError("Nope", ["a", "b"]))).toEqual({ message: "Nope", reasons: ["a", "b"] });
  });

  it("uses a plain Error's message", () => {
    expect(normalizeGenerationError(new Error("boom"))).toEqual({ message: "boom" });
  });

  it("falls back to a friendly message for anything else", () => {
    expect(normalizeGenerationError("weird")).toEqual({ message: "Something went wrong. Please try again." });
  });
});

describe("isAbortError", () => {
  it("is true only for an AbortError", () => {
    expect(isAbortError(new DOMException("x", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("x"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
