import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GenerationError, MEDIA_ANALYSIS_PROMPTS, type GenerationEngine } from "@chai-ui/core";
import { ChaiProvider, DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND } from "./ChaiProvider.js";
import type { MediaAnalyzerAttachment, MediaAnalyzerSubmitPayload } from "./MediaAnalyzer.js";
import { useMediaAnalyzer } from "./useMediaAnalyzer.js";

const fakeEngine = (generate: GenerationEngine["generate"]): GenerationEngine => ({ generate });
const media = (kind: "image" | "video" | "audio"): MediaAnalyzerAttachment => ({ id: kind, kind, src: `https://x/${kind}` });
const payload = (overrides: Partial<MediaAnalyzerSubmitPayload> = {}): MediaAnalyzerSubmitPayload => ({
  attachments: [media("image")],
  modelId: null,
  autoSelectModel: false,
  models: [],
  promptLength: null,
  ...overrides,
});
const withProvider = (engine: GenerationEngine) =>
  ({ children }: { children: ReactNode }) => <ChaiProvider reasoningEngine={engine}>{children}</ChaiProvider>;

describe("useMediaAnalyzer", () => {
  it("sends the instruction for the media's kind and length, with the media, and returns the prompt", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "A red mug on oak.", kind: "text" });
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });

    act(() => result.current.submit(payload({ promptLength: "detailed" })));
    expect(result.current.analyzing).toBe(true);
    await waitFor(() => expect(result.current.prompt).toBe("A red mug on oak."));

    expect(result.current.analyzing).toBe(false);
    const args = generate.mock.calls[0]![0];
    expect(args.prompt).toBe(MEDIA_ANALYSIS_PROMPTS.image.detailed);
    expect(args.attachments).toHaveLength(1);
    expect(args.modelId).toBe(DEFAULT_REASONING_MODEL);
  });

  it("uses the concise instruction when no length was picked", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });
    act(() => result.current.submit(payload()));
    await waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].prompt).toBe(MEDIA_ANALYSIS_PROMPTS.image.concise);
  });

  it("sends video and audio to the per-kind reasoning model", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });
    act(() => result.current.submit(payload({ attachments: [media("video")] })));
    await waitFor(() => expect(result.current.analyzing).toBe(false));
    act(() => result.current.submit(payload({ attachments: [media("audio")] })));
    await waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.video);
    expect(generate.mock.calls[1]![0].modelId).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
  });

  it("uses the model the person picked over the defaults", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "x", kind: "text" });
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });
    act(() => result.current.submit(payload({ modelId: "picked/model" })));
    await waitFor(() => expect(result.current.analyzing).toBe(false));
    expect(generate.mock.calls[0]![0].modelId).toBe("picked/model");
  });

  it("fills the prompt in while text streams", async () => {
    let finish!: (v: { src: string; kind: "text" }) => void;
    const generate = vi.fn(({ onText }) => {
      onText?.("A red");
      return new Promise((resolve) => (finish = resolve));
    });
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });
    act(() => result.current.submit(payload()));
    expect(result.current.prompt).toBe("A red");
    await act(async () => finish({ src: "A red mug.", kind: "text" }));
    expect(result.current.prompt).toBe("A red mug.");
  });

  it("surfaces an engine failure as `error` and calls onError", async () => {
    const onError = vi.fn();
    const engine = fakeEngine(async () => {
      throw new GenerationError("Analysis failed — the model timed out.");
    });
    const { result } = renderHook(() => useMediaAnalyzer({ onError }), { wrapper: withProvider(engine) });
    act(() => result.current.submit(payload()));
    await waitFor(() => expect(result.current.error).toBe("Analysis failed — the model timed out."));
    expect(result.current.analyzing).toBe(false);
    expect(onError).toHaveBeenCalledWith("Analysis failed — the model timed out.");
  });

  it("errors without calling the engine when nothing analyzable is attached", () => {
    const generate = vi.fn();
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });
    act(() => result.current.submit(payload({ attachments: [] })));
    expect(result.current.error).toMatch(/Attach an image, video, or audio/);
    expect(generate).not.toHaveBeenCalled();
  });

  it("drops a late reply from an earlier submit, and reset clears everything", async () => {
    const resolvers: ((v: { src: string; kind: "text" }) => void)[] = [];
    const generate = vi.fn(() => new Promise<{ src: string; kind: "text" }>((r) => resolvers.push(r)));
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate)) });

    act(() => result.current.submit(payload()));
    act(() => result.current.submit(payload()));
    await act(async () => resolvers[1]!({ src: "second", kind: "text" }));
    await act(async () => resolvers[0]!({ src: "first", kind: "text" }));
    expect(result.current.prompt).toBe("second");

    act(() => result.current.reset());
    expect(result.current.prompt).toBeNull();
    expect(result.current.analyzing).toBe(false);
  });

  it("works with no provider, answered by a mock text engine", async () => {
    const { result } = renderHook(() => useMediaAnalyzer());
    act(() => result.current.submit(payload()));
    await waitFor(() => expect(result.current.prompt).toMatch(/mock/), { timeout: 5000 });
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
    const { result } = renderHook(() => useMediaAnalyzer({ onModelChange }), { wrapper: withProvider(fakeEngine(generate)) });

    act(() => result.current.submit(payload({ attachments: [media("video")], autoSelectModel: true, models })));
    await waitFor(() => expect(result.current.prompt).toBe("A dog runs."));
    expect(generate.mock.calls[0]![0].prompt).toMatch(/Pick the one model/);
    expect(onModelChange).toHaveBeenCalledWith("google/gemini-3.8-flash");
    expect(generate.mock.calls[1]![0].modelId).toBe("google/gemini-3.8-flash");
  });

  it("cancel stops the call without showing an error", async () => {
    const generate = vi.fn(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_r, reject) => signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))))
    );
    const { result } = renderHook(() => useMediaAnalyzer(), { wrapper: withProvider(fakeEngine(generate as never)) });
    act(() => result.current.submit(payload()));
    act(() => result.current.cancel());
    await act(async () => {});
    expect((generate.mock.calls[0]![0].signal as AbortSignal).aborted).toBe(true);
    expect(result.current.analyzing).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
