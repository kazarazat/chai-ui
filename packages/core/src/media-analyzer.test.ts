import { describe, expect, it, vi } from "vitest";
import { GenerationError, type GenerationEngine } from "./engine.js";
import { MEDIA_ANALYSIS_PROMPTS } from "./media-analysis-prompts.js";
import {
  createMediaAnalyzerStore,
  type MediaAnalyzerAttachment,
  type MediaAnalyzerOptions,
  type MediaAnalyzerSubmitPayload,
} from "./media-analyzer.js";
import { createReasoning, DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND, type Reasoning } from "./reasoning.js";

const fakeEngine = (generate: GenerationEngine["generate"]): GenerationEngine => ({ generate });
const reasoningWith = (engine: GenerationEngine) => createReasoning({}, engine);
const media = (kind: "image" | "video" | "audio"): MediaAnalyzerAttachment => ({ id: kind, kind, src: `https://x/${kind}` });
const payload = (overrides: Partial<MediaAnalyzerSubmitPayload> = {}): MediaAnalyzerSubmitPayload => ({
  attachments: [media("image")],
  modelId: null,
  autoSelectModel: false,
  models: [],
  promptLength: null,
  ...overrides,
});

/** The store with the same `result.current` shape `useMediaAnalyzer` returns. */
function setup(options: MediaAnalyzerOptions = {}, provided?: Reasoning) {
  const store = createMediaAnalyzerStore(() => options, () => provided);
  return { result: { get current() { return { ...store.getState(), submit: store.submit, cancel: store.cancel, reset: store.reset }; } } };
}

describe("createMediaAnalyzerStore", () => {
  it("sends the instruction for the media's kind and length, with the media, and returns the prompt", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "A red mug on oak.", kind: "text" });
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));

    result.current.submit(payload({ promptLength: "detailed" }));
    expect(result.current.analyzing).toBe(true);
    await vi.waitFor(() => expect(result.current.prompt).toBe("A red mug on oak."));

    expect(result.current.analyzing).toBe(false);
    const args = generate.mock.calls[0]![0];
    expect(args.prompt).toBe(MEDIA_ANALYSIS_PROMPTS.image.detailed);
    expect(args.attachments).toHaveLength(1);
    expect(args.modelId).toBe(DEFAULT_REASONING_MODEL);
  });

  it("uses the concise instruction when no length was picked", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));
    result.current.submit(payload());
    await vi.waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].prompt).toBe(MEDIA_ANALYSIS_PROMPTS.image.concise);
  });

  it("sends video and audio to the per-kind reasoning model", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));
    result.current.submit(payload({ attachments: [media("video")] }));
    await vi.waitFor(() => expect(result.current.analyzing).toBe(false));
    result.current.submit(payload({ attachments: [media("audio")] }));
    await vi.waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.video);
    expect(generate.mock.calls[1]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
  });

  it("uses the model the person picked over the defaults", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));
    result.current.submit(payload({ modelId: "picked/model" }));
    await vi.waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].modelId).toBe("picked/model");
  });

  it("fills the prompt in while text streams", async () => {
    let finish!: (v: { src: string; kind: "text" }) => void;
    const generate = vi.fn(({ onText }) => {
      onText?.("A red");
      return new Promise((resolve) => (finish = resolve));
    });
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));
    result.current.submit(payload());
    expect(result.current.prompt).toBe("A red");
    finish({ src: "A red mug.", kind: "text" });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.prompt).toBe("A red mug.");
  });

  it("surfaces an engine failure as `error` and calls onError", async () => {
    const onError = vi.fn();
    const engine = fakeEngine(async () => {
      throw new GenerationError("Analysis failed — the model timed out.");
    });
    const { result } = setup({ onError }, reasoningWith(engine));
    result.current.submit(payload());
    await vi.waitFor(() => expect(result.current.error).toBe("Analysis failed — the model timed out."));
    expect(result.current.analyzing).toBe(false);
    expect(onError).toHaveBeenCalledWith("Analysis failed — the model timed out.");
  });

  it("errors without calling the engine when nothing analyzable is attached", () => {
    const generate = vi.fn();
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));
    result.current.submit(payload({ attachments: [] }));
    expect(result.current.error).toMatch(/Attach an image, video, or audio/);
    expect(generate).not.toHaveBeenCalled();
  });

  it("drops a late reply from an earlier submit, and reset clears everything", async () => {
    const resolvers: ((v: { src: string; kind: "text" }) => void)[] = [];
    const generate = vi.fn(() => new Promise<{ src: string; kind: "text" }>((r) => resolvers.push(r)));
    const { result } = setup({}, reasoningWith(fakeEngine(generate)));

    result.current.submit(payload());
    result.current.submit(payload());
    resolvers[1]!({ src: "second", kind: "text" });
    resolvers[0]!({ src: "first", kind: "text" });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.prompt).toBe("second");

    result.current.reset();
    expect(result.current.prompt).toBeNull();
    expect(result.current.analyzing).toBe(false);
  });

  it("works with no provider, answered by a mock text engine", async () => {
    const { result } = setup();
    result.current.submit(payload());
    await vi.waitFor(() => expect(result.current.prompt).toMatch(/mock/), { timeout: 5000 });
  });

  it("auto-select routes among the offered models first, reports the pick, then analyzes with it", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ src: "google/gemini-3.8-flash", kind: "text" })
      .mockResolvedValueOnce({ src: "A dog runs.", kind: "text" });
    const onModelChange = vi.fn();
    const models = [
      { id: "qwen/qwen3.8-omni-flash", label: "Qwen", provider: "qwen", speed: "fast" as const },
      { id: "google/gemini-3.8-flash", label: "Gemini", provider: "google", speed: "fast" as const },
    ];
    const { result } = setup({ onModelChange }, reasoningWith(fakeEngine(generate)));

    result.current.submit(payload({ attachments: [media("video")], autoSelectModel: true, models }));
    await vi.waitFor(() => expect(result.current.prompt).toBe("A dog runs."));
    expect(generate.mock.calls[0]![0].prompt).toMatch(/Pick the one model/);
    expect(onModelChange).toHaveBeenCalledWith("google/gemini-3.8-flash");
    expect(generate.mock.calls[1]![0].modelId).toBe("google/gemini-3.8-flash");
  });

  it("cancel stops the call without showing an error", async () => {
    const generate = vi.fn(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_r, reject) => signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))))
    );
    const { result } = setup({}, reasoningWith(fakeEngine(generate as never)));
    result.current.submit(payload());
    result.current.cancel();
    await Promise.resolve();
    expect((generate.mock.calls[0]![0].signal as AbortSignal).aborted).toBe(true);
    expect(result.current.analyzing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("auto-select without reasoning warns once, reports the fallback, and analyzes on the first model", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const generate = vi.fn().mockResolvedValue({ src: "A dog.", kind: "text" });
    const onRoutingFallback = vi.fn();
    const models = [
      { id: "first/model", label: "First", provider: "x", speed: "fast" as const },
      { id: "second/model", label: "Second", provider: "x", speed: "fast" as const },
    ];
    // An engine of its own, but no reasoning model to route with.
    const { result } = setup({ engine: fakeEngine(generate), onRoutingFallback });
    const routeAgain = async () => {
      result.current.submit(payload({ autoSelectModel: true, models }));
      await vi.waitFor(() => expect(result.current.analyzing).toBe(false));
    };
    await routeAgain();
    await routeAgain();
    expect(onRoutingFallback).toHaveBeenCalledWith(expect.objectContaining({ reason: "no-reasoning", modelId: "first/model" }));
    expect(generate.mock.calls.at(-1)![0].modelId).toBe("first/model");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("notifies listeners until they unsubscribe", () => {
    const store = createMediaAnalyzerStore(() => ({}));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.submit(payload({ attachments: [] }));
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    store.reset();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});

