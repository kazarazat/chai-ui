import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  GenerationError,
  PRECISE_EDIT_MODELS,
  ROUTING_MODEL_ID,
  type DroppedMedia,
  type EditRegion,
  type GenerationEngine,
  type ModelOption,
} from "@chai-ui/core";
import { DEFAULT_MODEL_ID, useComposer } from "./useComposer.js";
import { EDIT_IMAGE_USE_CASE, TEXT_USE_CASE } from "./Composer.js";
import type { ComposerSubmitPayload } from "./Composer.js";
import {
  ChaiProvider,
  DEFAULT_REASONING_MODEL,
  DEFAULT_REASONING_MODEL_BY_KIND,
  reasoningModelFor,
  useReasoning,
} from "./ChaiProvider.js";

function fakeEngine(impl: GenerationEngine["generate"]): GenerationEngine {
  return { generate: impl };
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

describe("useComposer", () => {
  it("with no model picked, still runs, letting the engine use its own default model", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate) }));

    act(() => result.current.submit(payload({ modelId: null })));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.modelId).toBe(DEFAULT_MODEL_ID);
    expect(generate.mock.calls[0]![0].modelId).toBeUndefined();
  });

  it("passes the picked aspect ratio to the engine", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate) }));

    act(() => result.current.submit(payload({ aspectRatio: "16:9" })));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(generate.mock.calls[0]![0].aspectRatio).toBe("16:9");
  });

  it("sends a text request (no use case picked) to the text engine with the builder's text model", async () => {
    const media = vi.fn();
    const text = vi.fn().mockResolvedValue({ src: "Hello!", kind: "text" as const });
    const { result } = renderHook(() =>
      useComposer({ engine: fakeEngine(media), textEngine: fakeEngine(text), textModel: "llm-1" })
    );

    act(() => result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null })));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.request.mode).toBe("text-to-text");
    expect(text.mock.calls[0]![0].modelId).toBe("llm-1");
    expect(media).not.toHaveBeenCalled();
    expect(result.current.run?.results[0]!.output).toEqual({ src: "Hello!", kind: "text" });
  });

  it("falls back to a mock text engine when no text or reasoning engine is set", async () => {
    const { result } = renderHook(() => useComposer());
    act(() => result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null })));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"), { timeout: 5000 });
    expect(result.current.run?.results[0]!.output?.kind).toBe("text");
  });

  it("runs every picked model as its own result in one run (multi-model select)", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate) }));

    act(() => result.current.submit(payload({ selections: [{ useCase: IMAGE, modelIds: ["model-a", "model-b"] }] })));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(result.current.runs).toHaveLength(1);
    expect(result.current.run?.results.map((r) => r.modelId)).toEqual(["model-a", "model-b"]);
  });

  it("creates one run per use case, each on its own engine (multi-use-case select)", async () => {
    const image = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const video = vi.fn().mockResolvedValue({ src: "https://x/clip.mp4", kind: "video" as const });
    const { result } = renderHook(() =>
      useComposer({ engineByKind: { image: fakeEngine(image), video: fakeEngine(video) } })
    );

    act(() =>
      result.current.submit(
        payload({
          selections: [
            { useCase: IMAGE, modelIds: ["img-1"] },
            { useCase: VIDEO, modelIds: ["vid-1", "vid-2"] },
          ],
        })
      )
    );
    await waitFor(() => expect(result.current.runs.every((r) => r.results.every((x) => x.status === "done"))).toBe(true));
    expect(result.current.runs.map((r) => r.request.mode)).toEqual(["text-to-image", "text-to-video"]);
    expect(image).toHaveBeenCalledTimes(1);
    expect(video).toHaveBeenCalledTimes(2);
  });

  it("creates a queued run immediately, then resolves it to done as the engine settles", async () => {
    let resolveGenerate!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (resolveGenerate = resolve)));
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload()));

    // Synchronous right after submit: the run and its (queued/running) result already exist —
    // a consumer can render "1 of 1" before any network call finishes.
    expect(result.current.run?.results).toHaveLength(1);
    expect(result.current.run?.results[0]!.status).toBe("running");

    act(() => resolveGenerate({ src: "https://x/img.png", kind: "image" }));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
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
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload()));
    act(() => emit("a red"));
    expect(result.current.run?.results[0]).toMatchObject({ status: "running", output: { src: "a red", kind: "text" } });

    act(() => finish({ src: "a red mug", kind: "text" }));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.output).toEqual({ src: "a red mug", kind: "text" });
  });

  it("puts the engine's evaluation verdicts on the settled result", async () => {
    const evaluations = [{ id: "brand", label: "Brand safe", passed: true }];
    const engine = fakeEngine(async () => ({ src: "https://x/img.png", kind: "image" as const, evaluations }));
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload()));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.evaluations).toEqual(evaluations);
  });

  it("moves a result to error, with the engine's message, when the engine call rejects", async () => {
    const engine = fakeEngine(() => Promise.reject(new Error("upstream exploded")));
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload()));

    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("error"));
    expect(result.current.run?.results[0]!.error?.message).toBe("upstream exploded");
  });

  it("derives request.mode from the use case + whether anything is attached", async () => {
    const engine = fakeEngine(async () => ({ src: "x", kind: "video" as const }));
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload({ useCase: VIDEO })));
    expect(result.current.run?.request.mode).toBe("text-to-video");
  });

  it("calls the engine with the picked model, the prompt, and the attachments", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" as const });
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate) }));

    const attachments = [{ src: "https://x/mug.png", kind: "image" as const }];
    act(() => result.current.submit(payload({ value: "make it blue", attachments })));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

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
    const { result } = renderHook(() => useComposer({ engine }));

    act(() => result.current.submit(payload({ value: "first" })));
    const firstRunId = result.current.run?.id;

    act(() => result.current.submit(payload({ value: "second" })));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.id).not.toBe(firstRunId);
    expect(result.current.run?.results[0]!.output?.src).toBe("https://x/second.png");

    // The first call's late arrival must not resurrect the stale run into state.
    act(() => resolveFirst({ src: "https://x/first.png", kind: "image" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.run?.results[0]!.output?.src).toBe("https://x/second.png");
  });

  it("calls onRun/onResult with the settled run and result id", async () => {
    const engine = fakeEngine(async () => ({ src: "https://x/img.png", kind: "image" as const }));
    const onRun = vi.fn();
    const onResult = vi.fn();
    const { result } = renderHook(() => useComposer({ engine, onRun, onResult }));

    act(() => result.current.submit(payload()));
    expect(onRun).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    const [passedRun, resultId] = onResult.mock.calls[0]!;
    expect(passedRun.id).toBe(onRun.mock.calls[0]![0].id);
    expect(resultId).toBe(onRun.mock.calls[0]![0].results[0].id);
  });

  it("leaves enhance undefined until both reasoningEngine and reasoningModel are set — same shape Composer expects for onEnhance", () => {
    const { result, rerender } = renderHook((props: { reasoningEngine?: GenerationEngine; reasoningModel?: string }) => useComposer(props), {
      initialProps: {},
    });
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
    const { result } = renderHook(() =>
      useComposer({
        reasoningEngine: fakeEngine(generate),
        reasoningModel: "google/gemini-2.5-flash",
      })
    );

    expect(result.current.enhancing).toBe(false);
    let rewritten: string | undefined;
    await act(async () => {
      rewritten = await result.current.enhance!("a mug");
    });

    expect(rewritten).toBe("a much better mug prompt");
    expect(result.current.enhancing).toBe(false);
    expect(generate.mock.calls[0]![0].prompt).toContain("a mug");
    expect(generate.mock.calls[0]![0].modelId).toBe("google/gemini-2.5-flash");
  });

  describe("with a ChaiProvider", () => {
    const providerWith = (engine: GenerationEngine) =>
      ({ children }: { children: ReactNode }) => (
        <ChaiProvider reasoningEngine={engine} reasoningModel="anthropic/claude-opus-5">{children}</ChaiProvider>
      );

    it("enhance uses the provider's reasoning engine and model", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "rewritten", kind: "text" });
      const { result } = renderHook(() => useComposer(), { wrapper: providerWith(fakeEngine(generate)) });

      await act(async () => {
        await result.current.enhance!("a mug");
      });
      expect(generate.mock.calls[0]![0].modelId).toBe("anthropic/claude-opus-5");
    });

    it("text requests use the provider's reasoning pair when no text engine is set", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "Hello!", kind: "text" });
      const { result } = renderHook(() => useComposer(), { wrapper: providerWith(fakeEngine(generate)) });

      act(() => result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null })));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(generate.mock.calls[0]![0].modelId).toBe("anthropic/claude-opus-5");
    });

    it("the hook's own pair overrides the provider's", async () => {
      const fromProvider = vi.fn();
      const fromHook = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
      const { result } = renderHook(
        () => useComposer({ reasoningEngine: fakeEngine(fromHook), reasoningModel: "hook-model" }),
        { wrapper: providerWith(fakeEngine(fromProvider)) }
      );

      await act(async () => {
        await result.current.enhance!("a mug");
      });
      expect(fromHook.mock.calls[0]![0].modelId).toBe("hook-model");
      expect(fromProvider).not.toHaveBeenCalled();
    });

    it("half a pair on the hook never borrows the provider's other half", () => {
      const { result } = renderHook(() => useComposer({ reasoningModel: "hook-model" }), {
        wrapper: providerWith(fakeEngine(vi.fn())),
      });
      expect(result.current.enhance).toBeUndefined();
    });

    it("defaults to OpenRouter with the suggested models, without calling anything", () => {
      const { result } = renderHook(() => useReasoning(), {
        wrapper: ({ children }: { children: ReactNode }) => <ChaiProvider>{children}</ChaiProvider>,
      });
      expect(result.current?.model).toBe(DEFAULT_REASONING_MODEL);
      expect(result.current?.modelByKind).toEqual(DEFAULT_REASONING_MODEL_BY_KIND);
      expect(result.current?.engine.generate).toBeInstanceOf(Function);
    });

    it("merges per-kind overrides over the defaults one kind at a time", () => {
      const { result } = renderHook(() => useReasoning(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ChaiProvider reasoningModelByKind={{ video: "qwen/qwen3.8-omni-flash" }}>{children}</ChaiProvider>
        ),
      });
      expect(result.current?.modelByKind.video).toBe("qwen/qwen3.8-omni-flash");
      expect(result.current?.modelByKind.audio).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
    });

    it("text requests with a video attached go to the video model", async () => {
      const generate = vi.fn().mockResolvedValue({ src: "A dog runs.", kind: "text" });
      const { result } = renderHook(() => useComposer(), { wrapper: providerWith(fakeEngine(generate)) });
      const clip = { src: "https://x/clip.mp4", kind: "video" as const };

      act(() => result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null, attachments: [clip] })));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.video);
    });
  });

  describe("reasoningModelFor", () => {
    const reasoning = {
      engine: fakeEngine(vi.fn()),
      model: "claude",
      modelByKind: { video: "gemini", audio: "gemini" },
    };
    it("uses the base model for text and images", () => {
      expect(reasoningModelFor(reasoning)).toBe("claude");
      expect(reasoningModelFor(reasoning, [{ src: "x", kind: "image" }])).toBe("claude");
    });
    it("routes to the first attachment kind with its own model", () => {
      expect(reasoningModelFor(reasoning, [{ src: "x", kind: "image" }, { src: "y", kind: "audio" }])).toBe("gemini");
    });
  });

  describe("auto-select routing", () => {
    const roster: ModelOption[] = [
      { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" },
      { id: "fal/pro", label: "Pro", provider: "fal", speed: "standard" },
    ];
    const autoPayload = () =>
      payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] });
    const providerWith = (engine: GenerationEngine) =>
      ({ children }: { children: ReactNode }) => <ChaiProvider reasoningEngine={engine}>{children}</ChaiProvider>;

    it("asks the reasoning model, reports the pick, and runs on it", async () => {
      const reason = vi.fn().mockResolvedValue({ src: "fal/pro", kind: "text" });
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const onModelChange = vi.fn();
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(media), onModelChange }), {
        wrapper: providerWith(fakeEngine(reason)),
      });

      act(() => result.current.submit(autoPayload()));
      expect(result.current.routing).toBe(true);
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));

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
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(media), onRoutingFallback }), {
        wrapper: providerWith(fakeEngine(reason)),
      });

      act(() => result.current.submit(autoPayload()));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(media.mock.calls[0]![0].modelId).toBe("fal/fast");
      expect(onRoutingFallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "request-failed", error: "401 Unauthorized" })
      );
    });

    it("without a provider, runs on the first listed model and warns once", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(media) }));
      act(() => result.current.submit(autoPayload()));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
      expect(media.mock.calls[0]![0].modelId).toBe("fal/fast");
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("doesn't route when auto-select is off", async () => {
      const reason = vi.fn();
      const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(media) }), {
        wrapper: providerWith(fakeEngine(reason)),
      });
      act(() => result.current.submit(payload()));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
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
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate as never), onError }));
      act(() => result.current.submit(payload()));
      await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("running"));

      act(() => result.current.cancel());
      expect(result.current.run?.results[0]!.status).toBe("cancelled");
      const signal = generate.mock.calls[0]![0].signal as AbortSignal;
      expect(signal.aborted).toBe(true);
      await act(async () => {});
      expect(result.current.run?.results[0]!.status).toBe("cancelled");
      expect(onError).not.toHaveBeenCalled();
    });

    it("a new submit aborts the previous submit's calls", async () => {
      const generate = hanging();
      const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate as never) }));
      act(() => result.current.submit(payload()));
      act(() => result.current.submit(payload()));
      expect((generate.mock.calls[0]![0].signal as AbortSignal).aborted).toBe(true);
      expect((generate.mock.calls[1]![0].signal as AbortSignal).aborted).toBe(false);
    });

    it("keeps a stopped stream's partial text", async () => {
      const generate = vi.fn(({ onText, signal }: { onText?: (t: string) => void; signal?: AbortSignal }) => {
        onText?.("Once upon");
        return new Promise((_r, reject) => signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))));
      });
      const { result } = renderHook(() => useComposer({ textEngine: fakeEngine(generate as never), textModel: "t" }));
      act(() => result.current.submit(payload({ useCase: TEXT_USE_CASE, modelId: null })));
      await waitFor(() => expect(result.current.run?.results[0]!.output?.src).toBe("Once upon"));
      act(() => result.current.cancel());
      expect(result.current.run?.results[0]).toMatchObject({ status: "cancelled", output: { src: "Once upon" } });
    });
  });
});

describe("useComposer while auto-select routes", () => {
  it("creates the run at submit, so a result card shows progress while the model is chosen", async () => {
    let answer!: (v: { src: string; kind: "text" }) => void;
    const reason = vi.fn(() => new Promise<{ src: string; kind: "text" }>((resolve) => (answer = resolve)));
    const media = vi.fn().mockResolvedValue({ src: "https://x/img.png", kind: "image" });
    // Two models, so there's a real choice to wait for.
    const roster: ModelOption[] = [
      { id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" },
      { id: "fal/pro", label: "Pro", provider: "fal", speed: "standard" },
    ];
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(media) }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ChaiProvider reasoningEngine={fakeEngine(reason)}>{children}</ChaiProvider>
      ),
    });

    act(() =>
      result.current.submit(payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] }))
    );
    expect(result.current.run?.results[0]).toMatchObject({ status: "queued", modelId: ROUTING_MODEL_ID });

    await waitFor(() => expect(reason).toHaveBeenCalled());
    await act(async () => answer({ src: "fal/fast", kind: "text" }));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));
    expect(result.current.run?.results[0]!.modelId).toBe("fal/fast");
  });

  it("cancelling while routing stops the placeholder", async () => {
    const reason = vi.fn(() => new Promise<never>(() => {}));
    const roster: ModelOption[] = [{ id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" }];
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(vi.fn()) }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ChaiProvider reasoningEngine={fakeEngine(reason)}>{children}</ChaiProvider>
      ),
    });
    act(() =>
      result.current.submit(payload({ modelId: null, autoSelectModel: true, selections: [{ useCase: IMAGE, modelIds: [], models: roster }] }))
    );
    act(() => result.current.cancel());
    expect(result.current.run?.results[0]!.status).toBe("cancelled");
    expect(result.current.routing).toBe(false);
  });
});

describe("useComposer editing an image", () => {
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
    const { result } = renderHook(() => useComposer());
    expect(result.current.edit).toBeNull();
  });

  it("starts with the original as the only version and no regions", () => {
    const { result } = renderHook(() => useComposer({ editImage: photo }));
    expect(result.current.edit).toMatchObject({ activeVersion: 0, regions: [] });
    expect(result.current.edit?.versions).toEqual([{ id: "original", src: photo.src, status: "done", regions: [] }]);
  });

  it("sends the regions as Flux 3 boxes, then shows the edit as a new version and clears the regions", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/edited.png", kind: "image" as const });
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate), editImage: photo }));
    const regions = [region(1, "Change Manager to Boss")];
    act(() => result.current.edit!.onRegionsChange(regions));

    act(() => result.current.submit(editPayload({ regions })));
    expect(result.current.edit?.activeVersion).toBe(1);
    expect(result.current.edit?.regions).toEqual([]);
    await waitFor(() => expect(result.current.edit?.versions[1]?.status).toBe("done"));

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
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate), editImage: photo }));

    act(() => result.current.submit(editPayload({ value: "make it night" })));
    await waitFor(() => expect(result.current.edit?.versions[1]?.status).toBe("done"));
    act(() => result.current.submit(editPayload({ value: "add stars" })));
    await waitFor(() => expect(result.current.edit?.versions[2]?.status).toBe("done"));

    expect(generate.mock.calls[1]![0].attachments).toEqual([{ src: "https://x/one.png", kind: "image" }]);
    expect(generate.mock.calls[1]![0].prompt).toBe("add stars");
    expect(result.current.edit?.activeVersion).toBe(2);
  });

  it("describes regions in words for a model without box support", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const plain: ModelOption = { id: "fal/other-edit", label: "Other", provider: "fal", speed: "fast" };
    const { result } = renderHook(() => useComposer({ engine: fakeEngine(generate), editImage: photo }));
    act(() =>
      result.current.submit(
        editPayload({
          regions: [region(2, "remove the logo")],
          modelId: plain.id,
          selections: [{ useCase: EDIT_IMAGE_USE_CASE, modelIds: [plain.id], models: [plain] }],
        })
      )
    );
    await waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0]![0].prompt).toContain("Region 2 (from 50% to 75% across and 25% to 35% down): remove the logo.");
  });

  it("starts over when the image changes", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result, rerender } = renderHook(({ image }) => useComposer({ engine: fakeEngine(generate), editImage: image }), {
      initialProps: { image: photo },
    });
    act(() => result.current.submit(editPayload({ value: "x" })));
    await waitFor(() => expect(result.current.edit?.versions).toHaveLength(2));

    rerender({ image: { src: "data:image/png;base64,BBB", kind: "image" } });
    expect(result.current.edit?.versions).toHaveLength(1);
    expect(result.current.edit?.activeVersion).toBe(0);
  });
});

