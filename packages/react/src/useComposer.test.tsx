// The behavior lives in `@chai-ui/core` (composer.test.ts). These cover
// what the React binding adds: state that re-renders, the provider, and
// options read at render time.
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DroppedMedia, GenerationEngine } from "@chai-ui/core";
import { useComposer } from "./useComposer.js";
import type { ComposerSubmitPayload } from "./Composer.js";
import { ChaiProvider, DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND, useReasoning } from "./ChaiProvider.js";

const fakeEngine = (generate: GenerationEngine["generate"]): GenerationEngine => ({ generate });
const IMAGE = { kind: "image" as const, label: "Image" };
const payload: ComposerSubmitPayload = {
  value: "a red mug",
  attachments: [],
  aspectRatio: null,
  useCase: IMAGE,
  modelId: "model-a",
  autoSelectModel: false,
  selections: [{ useCase: IMAGE, modelIds: ["model-a"], models: [] }],
};
const providerWith = (engine: GenerationEngine) =>
  ({ children }: { children: ReactNode }) => <ChaiProvider reasoningEngine={engine}>{children}</ChaiProvider>;

describe("useComposer", () => {
  it("re-renders as the run moves from running to done, with stable actions", async () => {
    let finish!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (finish = resolve)));
    const { result, rerender } = renderHook(() => useComposer({ engine }));
    const { submit, cancel } = result.current;

    act(() => result.current.submit(payload));
    expect(result.current.run?.results[0]!.status).toBe("running");
    act(() => finish({ src: "https://x/img.png", kind: "image" }));
    await waitFor(() => expect(result.current.run?.results[0]!.status).toBe("done"));

    rerender();
    expect(result.current.submit).toBe(submit);
    expect(result.current.cancel).toBe(cancel);
  });

  it("leaves enhance undefined until both reasoningEngine and reasoningModel are set", () => {
    const engine = fakeEngine(async () => ({ src: "x", kind: "text" as const }));
    const { result, rerender } = renderHook((props: { reasoningEngine?: GenerationEngine; reasoningModel?: string }) => useComposer(props), {
      initialProps: {},
    });
    expect(result.current.enhance).toBeUndefined();
    rerender({ reasoningEngine: engine });
    expect(result.current.enhance).toBeUndefined();
    rerender({ reasoningEngine: engine, reasoningModel: "m" });
    expect(result.current.enhance).toBeInstanceOf(Function);
  });

  it("enhance uses the provider's pair and toggles `enhancing`", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "rewritten", kind: "text" });
    const { result } = renderHook(() => useComposer(), { wrapper: providerWith(fakeEngine(generate)) });
    let rewritten: string | undefined;
    await act(async () => {
      rewritten = await result.current.enhance!("a mug");
    });
    expect(rewritten).toBe("rewritten");
    expect(result.current.enhancing).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);
  });

  it("half a pair on the hook never borrows the provider's other half", () => {
    const { result } = renderHook(() => useComposer({ reasoningModel: "hook-model" }), {
      wrapper: providerWith(fakeEngine(vi.fn())),
    });
    expect(result.current.enhance).toBeUndefined();
  });

  it("starts the edit over in the same render the image changes", async () => {
    const photo: DroppedMedia = { src: "data:image/png;base64,AAA", kind: "image" };
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result, rerender } = renderHook(({ image }) => useComposer({ engine: fakeEngine(generate), editImage: image }), {
      initialProps: { image: photo },
    });
    const useCase = { kind: "image" as const, label: "Edit image", edit: true };
    act(() =>
      result.current.submit({ ...payload, value: "x", useCase, selections: [{ useCase, modelIds: ["m"], models: [] }] })
    );
    await waitFor(() => expect(result.current.edit?.versions).toHaveLength(2));

    const firstId = result.current.edit?.versions[0]!.id;
    rerender({ image: { src: "data:image/png;base64,BBB", kind: "image" } });
    expect(result.current.edit?.versions).toHaveLength(1);
    expect(result.current.edit?.versions[0]!.id).not.toBe(firstId);
  });
});

describe("ChaiProvider", () => {
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
});
