import { describe, expect, it, vi } from "vitest";
import {
  createComposerStore,
  DEFAULT_MODEL_ID,
  EDIT_IMAGE_USE_CASE,
  TEXT_USE_CASE,
  type ComposerOptions,
  type ComposerSubmitPayload,
} from "./composer.js";
import { GenerationError, type GenerationEngine } from "./engine.js";
import { PRECISE_EDIT_MODELS, type EditRegion } from "./region-edit.js";
import { createReasoning, DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND, pickReasoning, type Reasoning } from "./reasoning.js";
import { ROUTING_MODEL_ID } from "./run.js";
import type { DroppedMedia, ModelOption } from "./types.js";

function fakeEngine(impl: GenerationEngine["generate"]): GenerationEngine {
  return { generate: impl };
}

/** A provider's reasoning with the default models on `engine`. */
const reasoningWith = (engine: GenerationEngine) => createReasoning({}, engine);

/** The store with the same `result.current` shape `useComposer` returns; `rerender` swaps the options. */
function setup(initial: ComposerOptions = {}, provided?: Reasoning) {
  let options = initial;
  const store = createComposerStore(() => options, () => provided);
  const result = {
    get current() {
      const s = store.getState();
      return {
        run: s.runs[0] ?? null,
        runs: s.runs,
        routing: s.routing,
        enhancing: s.enhancing,
        submit: store.submit,
        cancel: store.cancel,
        enhance: pickReasoning(options, provided) ? store.enhance : undefined,
        edit: store.edit(s, options.editImage),
      };
    },
  };
  return { result, rerender: (next: ComposerOptions) => void (options = next) };
}

const IMAGE = { kind: "image" as const, label: "Image" };
const VIDEO = { kind: "video" as const, label: "Video" };

/** An image request for "model-a" unless overridden; `selections` follows `useCase`/`modelId` unless given. */
function payload(overrides: Partial<ComposerSubmitPayload> = {}): ComposerSubmitPayload {
  const useCase = overrides.useCase ?? IMAGE;
  const modelId = overrides.modelId === undefined ? "model-a" : overrides.modelId;
  return {
    value: "a red mug",
    attachments: [],
    aspectRatio: null,
    ...overrides,
    useCase,
    modelId,
    autoSelectModel: overrides.autoSelectModel ?? false,
    selections: overrides.selections ?? [{ useCase, modelIds: modelId ? [modelId] : [], models: [] }],
  };
}

describe("createComposerStore", () => {
  it("with no model picked, still runs, letting the engine use its own default model", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate) });

    result.current.submit(payload({ modelId: null }));
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.modelId).toBe(DEFAULT_MODEL_ID);
    expect(generate.mock.calls[0]![0].modelId).toBeUndefined();
  });

  it("passes the picked aspect ratio to the engine", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate) });

    result.current.submit(payload({ aspectRatio: "16:9" }));
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(generate.mock.calls[0]![0].aspectRatio).toBe("16:9");
  });

  it("sends a text request (no use case picked) to the text engine with the builder's text model", async () => {
    const media = vi.fn();
    const text = vi.fn().mockResolvedValue({ src: "Hello!", kind: "text" as const });
    const { result } = setup({ engine: fakeEngine(media), textEngine: fakeEngine(text), textModel: "llm-1" });

    result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null }));
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.request.mode).toBe("text-to-text");
    expect(text.mock.calls[0]![0].modelId).toBe("llm-1");
    expect(media).not.toHaveBeenCalled();
    expect(result.current.run?.results[0]!.output).toEqual({ src: "Hello!", kind: "text" });
  });

  it("falls back to a mock text engine when no text or reasoning engine is set", async () => {
    const { result } = setup();
    result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null }));
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"), { timeout: 5000 });
    expect(result.current.run?.results[0]!.output?.kind).toBe("text");
  });

  it("runs every picked model as its own result in one run (multi-model select)", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate) });

    result.current.submit(payload({ selections: [{ useCase: IMAGE, modelIds: ["model-a", "model-b"] }] }));
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(result.current.runs).toHaveLength(1);
    expect(result.current.run?.results.map((r) => r.modelId)).toEqual(["model-a", "model-b"]);
  });

  it("creates one run per use case, each on its own engine (multi-use-case select)", async () => {
    const image = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const video = vi.fn().mockResolvedValue({ src: "https://x/clip.mp4", kind: "video" as const });
    const { result } = setup({ engineByKind: { image: fakeEngine(image), video: fakeEngine(video) } });

    result.current.submit(
        payload({
          selections: [
            { useCase: IMAGE, modelIds: ["img-1"] },
            { useCase: VIDEO, modelIds: ["vid-1", "vid-2"] },
          ],
        })
      );
    await vi.waitFor(() => expect(result.current.runs.every((r) => r.results.every((x) => x.status === "done"))).toBe(true));
    expect(result.current.runs.map((r) => r.request.mode)).toEqual(["text-to-image", "text-to-video"]);
    expect(image).toHaveBeenCalledTimes(1);
    expect(video).toHaveBeenCalledTimes(2);
  });

  it("creates a queued run immediately, then resolves it to done as the engine settles", async () => {
    let resolveGenerate!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (resolveGenerate = resolve)));
    const { result } = setup({ engine });

    result.current.submit(payload());

    // Synchronous right after submit: the run and its (queued/running) result already exist —
    // a consumer can render "1 of 1" before any network call finishes.
    expect(result.current.run?.results).toHaveLength(1);
    expect(result.current.run?.results[0]!.status).toBe("running");

    resolveGenerate({ src: "https://x/img.png", kind: "image" });
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.output).toEqual({ src: "https://x/img.png", kind: "image" });
  });

  it("shows streamed text on a still-running result, then the final output once it settles", async () => {
    let emit!: (text: string) => void;
    let finish!: (v: { src: string; kind: "text" }) => void;
    const engine = fakeEngine(
      ({ onText }) =>
        new Promise((resolve) => {
          emit = onText!;
          finish = resolve;
        })
    );
    const { result } = setup({ engine });

    result.current.submit(payload());
    emit("a red");
    expect(result.current.run?.results[0]).toMatchObject({ status: "running", output: { src: "a red", kind: "text" } });

    finish({ src: "a red mug", kind: "text" });
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.output).toEqual({ src: "a red mug", kind: "text" });
  });

  it("puts the engine's evaluation verdicts on the settled result", async () => {
    const evaluations = [{ id: "brand", label: "Brand safe", passed: true }];
    const engine = fakeEngine(async () => ({ src: "https://x/img.png", kind: "image" as const, evaluations }));
    const { result } = setup({ engine });

    result.current.submit(payload());
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.evaluations).toEqual(evaluations);
  });

  it("moves a result to error, with the engine's message, when the engine call rejects", async () => {
    const engine = fakeEngine(() => Promise.reject(new Error("upstream exploded")));
    const { result } = setup({ engine });

    result.current.submit(payload());

    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("error"));
    expect(result.current.run?.results[0]!.error?.message).toBe("upstream exploded");
  });

  it("derives request.mode from the use case + whether anything is attached", async () => {
    const engine = fakeEngine(async () => ({ src: "x", kind: "video" as const }));
    const { result } = setup({ engine });

    result.current.submit(payload({ useCase: VIDEO }));
    expect(result.current.run?.request.mode).toBe("text-to-video");
  });

  it("calls the engine with the picked model, the prompt, and the attachments", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate) });

    const attachments = [{ src: "https://x/mug.png", kind: "image" as const }];
    result.current.submit(payload({ value: "make it blue", attachments }));
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

    expect(generate.mock.calls[0]![0]).toEqual({
      modelId: payload().modelId,
      prompt: "make it blue",
      attachments,
      onText: expect.any(Function),
      signal: expect.any(AbortSignal),
    });
  });

  it("a second submit's result is not clobbered by the first (now-stale) run finishing late", async () => {
    let resolveFirst!: (v: { src: string; kind: "image" }) => void;
    const generate = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(async () => ({ src: "https://x/second.png", kind: "image" as const }));
    const engine = fakeEngine(generate);
    const { result } = setup({ engine });

    result.current.submit(payload({ value: "first" }));
    const firstRunId = result.current.run?.id;

    result.current.submit(payload({ value: "second" }));
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.id).not.toBe(firstRunId);
    expect(result.current.run?.results[0]!.output?.src).toBe("https://x/second.png");

    // The first call's late arrival must not resurrect the stale run into state.
    resolveFirst({ src: "https://x/first.png", kind: "image" });
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.run?.results[0]!.output?.src).toBe("https://x/second.png");
  });

  it("calls onRun/onResult with the settled run and result id", async () => {
    const engine = fakeEngine(async () => ({ src: "https://x/img.png", kind: "image" as const }));
    const onRun = vi.fn();
    const onResult = vi.fn();
    const { result } = setup({ engine, onRun, onResult });

    result.current.submit(payload());
    expect(onRun).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    const [passedRun, resultId] = onResult.mock.calls[0]!;
    expect(passedRun.id).toBe(onRun.mock.calls[0]![0].id);
    expect(resultId).toBe(onRun.mock.calls[0]![0].results[0].id);
  });

  it("leaves enhance undefined until both reasoningEngine and reasoningModel are set — same shape Composer expects for onEnhance", () => {
    const { result, rerender } = setup();
    expect(result.current.enhance).toBeUndefined();

    rerender({ reasoningEngine: fakeEngine(async () => ({ src: "x", kind: "text" as const })) });
    expect(result.current.enhance).toBeUndefined();

    rerender({
      reasoningEngine: fakeEngine(async () => ({ src: "x", kind: "text" as const })),
      reasoningModel: "google/gemini-2.5-flash",
    });
    expect(result.current.enhance).toBeInstanceOf(Function);
  });

  it("enhance sends a wrapped prompt to the reasoning engine, returns the rewrite, and toggles `enhancing`", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "a much better mug prompt", kind: "text" });
    const { result } = setup({ reasoningEngine: fakeEngine(generate), reasoningModel: "google/gemini-2.5-flash" });

    expect(result.current.enhancing).toBe(false);
    const rewritten = await result.current.enhance!("a mug");

    expect(rewritten).toBe("a much better mug prompt");
    expect(result.current.enhancing).toBe(false);
    expect(generate.mock.calls[0]![0].prompt).toContain("a mug");
    expect(generate.mock.calls[0]![0].modelId).toBe("google/gemini-2.5-flash");
  });

  describe("with a provider's reasoning", () => {
    it("enhance uses the provider's reasoning engine and model", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "rewritten", kind: "text" });
      const { result } = setup({}, reasoningWith(fakeEngine(generate)));

      await result.current.enhance!("a mug");
      expect(generate.mock.calls[0]![0].modelId).toBe("anthropic/claude-opus-5");
    });

    it("text requests use the provider's reasoning pair when no text engine is set", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "Hello!", kind: "text" });
      const { result } = setup({}, reasoningWith(fakeEngine(generate)));

      result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null }));
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(generate.mock.calls[0]![0].modelId).toBe("anthropic/claude-opus-5");
    });

    it("the hook's own pair overrides the provider's", async () => {
      const fromProvider = vi.fn();
      const fromHook = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
      const { result } = setup({ reasoningEngine: fakeEngine(fromHook), reasoningModel: "hook-model" }, reasoningWith(fakeEngine(fromProvider)));

      await result.current.enhance!("a mug");
      expect(fromHook.mock.calls[0]![0].modelId).toBe("hook-model");
      expect(fromProvider).not.toHaveBeenCalled();
    });

    it("half a pair on the hook never borrows the provider's other half", () => {
      const { result } = setup({ reasoningModel: "hook-model" }, reasoningWith(fakeEngine(vi.fn())));
      expect(result.current.enhance).toBeUndefined();
    });

    it("text requests with a video attached go to the video model", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "A dog runs.", kind: "text" });
      const { result } = setup({}, reasoningWith(fakeEngine(generate)));
      const clip = { src: "https://x/clip.mp4", kind: "video" as const };

      result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null, attachments: [clip] }));
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.video);
    });
  });

  describe("auto-select routing", () => {
    const roster: ModelOption[] = [
      { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" },
      { id: "fal/pro", label: "Pro", provider: "fal", speed: "standard" },
    ];
    const autoPayload = () =>
      payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] });

    it("asks the reasoning model, reports the pick, and runs on it", async () => {
      const reason = vi.fn().mockResolvedValue({ src: "fal/pro", kind: "text" });
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const onModelChange = vi.fn();
      const { result } = setup({ engine: fakeEngine(media), onModelChange }, reasoningWith(fakeEngine(reason)));

      result.current.submit(autoPayload());
      expect(result.current.routing).toBe(true);
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));

      expect(result.current.routing).toBe(false);
      expect(reason.mock.calls[0]![0].prompt).toContain("Request: a red mug");
      expect(reason.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);
      expect(onModelChange).toHaveBeenCalledWith("fal/pro");
      expect(media.mock.calls[0]![0].modelId).toBe("fal/pro");
    });

    it("falls back to the first listed model when the reasoning call fails, and still runs", async () => {
      const reason = vi.fn().mockRejectedValue(new GenerationError("401 Unauthorized"));
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const onRoutingFallback = vi.fn();
      const { result } = setup({ engine: fakeEngine(media), onRoutingFallback }, reasoningWith(fakeEngine(reason)));

      result.current.submit(autoPayload());
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(media.mock.calls[0]![0].modelId).toBe("fal/fast");
      expect(onRoutingFallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "request-failed", error: "401 Unauthorized" })
      );
    });

    it("without a provider, runs on the first listed model and warns once", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const { result } = setup({ engine: fakeEngine(media) });
      result.current.submit(autoPayload());
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(media.mock.calls[0]![0].modelId).toBe("fal/fast");
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("doesn't route when auto-select is off", async () => {
      const reason = vi.fn();
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const { result } = setup({ engine: fakeEngine(media) }, reasoningWith(fakeEngine(reason)));
      result.current.submit(payload());
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(reason).not.toHaveBeenCalled();
      expect(media.mock.calls[0]![0].modelId).toBe("model-a");
    });
  });

  describe("cancel", () => {
    const hanging = () =>
      vi.fn(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) =>
            signal?.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")))
          )
      );

    it("aborts the engine call and marks the result cancelled right away", async () => {
      const generate = hanging();
      const onError = vi.fn();
      const { result } = setup({ engine: fakeEngine(generate as never), onError });
      result.current.submit(payload());
      await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("running"));

      result.current.cancel();
      expect(result.current.run?.results[0]!.status).toBe("cancelled");
      const signal = generate.mock.calls[0]![0].signal as AbortSignal;
      expect(signal.aborted).toBe(true);
      await Promise.resolve();
      expect(result.current.run?.results[0]!.status).toBe("cancelled");
      expect(onError).not.toHaveBeenCalled();
    });

    it("a new submit aborts the previous submit's calls", async () => {
      const generate = hanging();
      const { result } = setup({ engine: fakeEngine(generate as never) });
      result.current.submit(payload());
      result.current.submit(payload());
      expect((generate.mock.calls[0]![0].signal as AbortSignal).aborted).toBe(true);
      expect((generate.mock.calls[1]![0].signal as AbortSignal).aborted).toBe(false);
    });

    it("keeps a stopped stream's partial text", async () => {
      const generate = vi.fn(({ onText, signal }: { onText?: (t: string) => void; signal?: AbortSignal }) => {
        onText?.("Once upon");
        return new Promise((_r, reject) => signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))));
      });
      const { result } = setup({ textEngine: fakeEngine(generate as never), textModel: "t" });
      result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null }));
      await vi.waitFor(() => expect(result.current.run?.results[0]!.output?.src).toBe("Once upon"));
      result.current.cancel();
      expect(result.current.run?.results[0]).toMatchObject({ status: "cancelled", output: { src: "Once upon" } });
    });
  });
});

describe("createComposerStore while auto-select routes", () => {
  it("creates the run at submit, so a result card shows progress while the model is chosen", async () => {
    let answer!: (v: { src: string; kind: "text" }) => void;
    const reason = vi.fn(() => new Promise<{ src: string; kind: "text" }>((resolve) => (answer = resolve)));
    const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
    // Two models, so there's a real choice to wait for.
    const roster: ModelOption[] = [
      { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" },
      { id: "fal/pro", label: "Pro", provider: "fal", speed: "standard" },
    ];
    const { result } = setup({ engine: fakeEngine(media) }, reasoningWith(fakeEngine(reason)));

    result.current.submit(payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] }));
    expect(result.current.run?.results[0]).toMatchObject({ status: "queued", modelId: ROUTING_MODEL_ID });

    await vi.waitFor(() => expect(reason).toHaveBeenCalled());
    answer({ src: "fal/fast", kind: "text" });
    await vi.waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.modelId).toBe("fal/fast");
  });

  it("cancelling while routing stops the placeholder", async () => {
    const reason = vi.fn(() => new Promise<never>(() => {}));
    const roster: ModelOption[] = [{ id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" }];
    const { result } = setup({ engine: fakeEngine(vi.fn()) }, reasoningWith(fakeEngine(reason)));
          result.current.submit(payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] }));
    result.current.cancel();
    expect(result.current.run?.results[0]!.status).toBe("cancelled");
    expect(result.current.routing).toBe(false);
  });
});

describe("createComposerStore editing an image", () => {
  const photo: DroppedMedia = { src: "data:image/png;base64,AAA", kind: "image" };
  const region = (number: number, prompt: string): EditRegion => ({
    id: `r${number}`,
    number,
    box: { x: 0.5, y: 0.25, width: 0.25, height: 0.1 },
    prompt,
  });
  const flux = PRECISE_EDIT_MODELS[0]!;
  const editPayload = (overrides: Partial<ComposerSubmitPayload> = {}) =>
    payload({
      value: "",
      attachments: [{ ...photo, id: "a1" }],
      useCase: EDIT_IMAGE_USE_CASE,
      modelId: flux.id,
      selections: [{ useCase: EDIT_IMAGE_USE_CASE, modelIds: [flux.id], models: PRECISE_EDIT_MODELS }],
      ...overrides,
    });

  it("returns no edit without an image to edit", () => {
    const { result } = setup();
    expect(result.current.edit).toBeNull();
  });

  it("starts with the original as the only version and no regions", () => {
    const { result } = setup({ editImage: photo });
    expect(result.current.edit).toMatchObject({ activeVersion: 0, regions: [] });
    expect(result.current.edit?.versions).toEqual([{ id: "original-0", src: photo.src, status: "done", regions: [] }]);
  });

  it("sends the regions as Flux 3 boxes, then shows the edit as a new version and clears the regions", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/edited.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate), editImage: photo });
    const regions = [region(1, "Change Manager to Boss")];
    result.current.edit!.onRegionsChange(regions);

    result.current.submit(editPayload({ regions }));
    expect(result.current.edit?.activeVersion).toBe(1);
    expect(result.current.edit?.regions).toEqual([]);
    await vi.waitFor(() => expect(result.current.edit?.versions[1]?.status).toBe("done"));

    const call = generate.mock.calls[0]![0];
    expect(call.attachments).toEqual([photo]);
    expect(call.prompt).toContain("<region_1>: Change Manager to Boss");
    expect(call.prompt).toContain('"tgt_bbox":[250,500,350,750]');
    expect(result.current.edit?.versions[1]).toMatchObject({ src: "https://x/edited.png", from: photo.src, regions });
  });

  it("edits the version showing, so edits build on each other", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ src: "https://x/one.png", kind: "image" as const })
      .mockResolvedValueOnce({ src: "https://x/two.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate), editImage: photo });

    result.current.submit(editPayload({ value: "make it night" }));
    await vi.waitFor(() => expect(result.current.edit?.versions[1]?.status).toBe("done"));
    result.current.submit(editPayload({ value: "add stars" }));
    await vi.waitFor(() => expect(result.current.edit?.versions[2]?.status).toBe("done"));

    expect(generate.mock.calls[1]![0].attachments).toEqual([{ src: "https://x/one.png", kind: "image" }]);
    expect(generate.mock.calls[1]![0].prompt).toBe("add stars");
    expect(result.current.edit?.activeVersion).toBe(2);
  });

  it("describes regions in words for a model without box support", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const plain: ModelOption = { id: "fal/other-edit", label: "Other", provider: "fal", speed: "fast" };
    const { result } = setup({ engine: fakeEngine(generate), editImage: photo });
    result.current.submit(
        editPayload({
          regions: [region(2, "remove the logo")],
          modelId: plain.id,
          selections: [{ useCase: EDIT_IMAGE_USE_CASE, modelIds: [plain.id], models: [plain] }],
        })
      );
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0]![0].prompt).toContain("Region 2 (from 50% to 75% across and 25% to 35% down): remove the logo.");
  });

  it("with auto-select, shows a placeholder version while routing, then replaces it with the real edit", async () => {
    let answer!: (v: { src: string; kind: "text" }) => void;
    const reason = vi.fn(() => new Promise<{ src: string; kind: "text" }>((resolve) => (answer = resolve)));
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result } = setup({ engine: fakeEngine(generate), editImage: photo }, reasoningWith(fakeEngine(reason)));
    const other: ModelOption = { id: "fal/other-edit", label: "Other", provider: "fal", speed: "fast" };
    const selections = [{ useCase: EDIT_IMAGE_USE_CASE, modelIds: [], models: [flux, other] }];

    result.current.submit(editPayload({ value: "x", modelId: null, autoSelectModel: true, selections }));
    expect(result.current.edit?.versions).toHaveLength(2);
    expect(result.current.edit?.activeVersion).toBe(1);

    await vi.waitFor(() => expect(reason).toHaveBeenCalled());
    answer({ src: flux.id, kind: "text" });
    await vi.waitFor(() => expect(result.current.edit?.versions[1]?.status).toBe("done"));
    expect(result.current.edit?.versions).toHaveLength(2);
    expect(generate.mock.calls[0]![0].modelId).toBe(flux.id);
  });

  it("starts over when the image changes", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result, rerender } = setup({ engine: fakeEngine(generate), editImage: photo });
    result.current.submit(editPayload({ value: "x" }));
    await vi.waitFor(() => expect(result.current.edit?.versions).toHaveLength(2));

    const firstId = result.current.edit?.versions[0]!.id;
    rerender({ engine: fakeEngine(generate), editImage: { src: "data:image/png;base64,BBB", kind: "image" } });
    expect(result.current.edit?.versions).toHaveLength(1);
    expect(result.current.edit?.activeVersion).toBe(0);
    // A new id, so EditCard starts the new image clean.
    expect(result.current.edit?.versions[0]!.id).not.toBe(firstId);
  });
});

describe("createComposerStore subscriptions", () => {
  it("notifies listeners on each change until they unsubscribe", () => {
    const store = createComposerStore(() => ({ engine: fakeEngine(() => new Promise(() => {})) }));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.submit(payload());
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    store.cancel();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});
