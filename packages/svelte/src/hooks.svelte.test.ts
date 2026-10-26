// The behavior lives in `@chai-ui/core` (composer.test.ts,
// media-analyzer.test.ts). These cover what the Svelte binding adds:
// reactive fields, the provider, and options read through a function.
import { flushSync, mount, unmount, type ComponentProps } from "svelte";
import { describe, expect, it, vi } from "vitest";
import type { ComposerSubmitPayload, DroppedMedia, GenerationEngine } from "@chai-ui/core";
import { DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND } from "@chai-ui/core";
import type ChaiProvider from "./ChaiProvider.svelte";
import Setup from "./__tests__/fixtures/Setup.svelte";
import { useReasoning } from "./reasoning.js";
import { useComposer } from "./useComposer.svelte.js";
import { useMediaAnalyzer } from "./useMediaAnalyzer.svelte.js";

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

/** Runs `use` in a component, optionally inside a ChaiProvider, and returns what it returned. */
function withSetup<T>(use: () => T, provider?: Omit<ComponentProps<typeof ChaiProvider>, "children">) {
  let result!: T;
  const app = mount(Setup, {
    target: document.body,
    props: { use, done: (r: unknown) => (result = r as T), provider },
  });
  // Effects (and so `onDestroy`'s registration) run on the next flush, as in an app.
  flushSync();
  return { result, unmount: () => unmount(app) };
}

describe("useComposer", () => {
  it("updates its fields as the run moves from running to done", async () => {
    let finish!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (finish = resolve)));
    const { result } = withSetup(() => useComposer({ engine }));

    result.submit(payload);
    expect(result.run?.results[0]!.status).toBe("running");
    expect(result.runs).toHaveLength(1);
    finish({ src: "https://x/img.png", kind: "image" });
    await vi.waitFor(() => expect(result.run?.results[0]!.status).toBe("done"));
  });

  it("leaves enhance undefined until both reasoningEngine and reasoningModel are set", () => {
    const engine = fakeEngine(async () => ({ src: "x", kind: "text" as const }));
    let options = $state<{ reasoningEngine?: GenerationEngine; reasoningModel?: string }>({});
    const { result } = withSetup(() => useComposer(() => options));
    expect(result.enhance).toBeUndefined();
    options = { reasoningEngine: engine };
    expect(result.enhance).toBeUndefined();
    options = { reasoningEngine: engine, reasoningModel: "m" };
    expect(result.enhance).toBeInstanceOf(Function);
  });

  it("enhance uses the provider's pair and toggles `enhancing`", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "rewritten", kind: "text" });
    const { result } = withSetup(() => useComposer(), { reasoningEngine: fakeEngine(generate) });
    const pending = result.enhance!("a mug");
    expect(result.enhancing).toBe(true);
    expect(await pending).toBe("rewritten");
    expect(result.enhancing).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);
  });

  it("half a pair never borrows the provider's other half", () => {
    const { result } = withSetup(() => useComposer({ reasoningModel: "hook-model" }), {
      reasoningEngine: fakeEngine(vi.fn()),
    });
    expect(result.enhance).toBeUndefined();
  });

  it("starts the edit over as soon as the image changes", async () => {
    let image = $state<DroppedMedia>({ src: "data:image/png;base64,AAA", kind: "image" });
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result } = withSetup(() => useComposer(() => ({ engine: fakeEngine(generate), editImage: image })));
    const useCase = { kind: "image" as const, label: "Edit image", edit: true };
    result.submit({ ...payload, value: "x", useCase, selections: [{ useCase, modelIds: ["m"], models: [] }] });
    await vi.waitFor(() => expect(result.edit?.versions).toHaveLength(2));

    const firstId = result.edit?.versions[0]!.id;
    image = { src: "data:image/png;base64,BBB", kind: "image" };
    expect(result.edit?.versions).toHaveLength(1);
    expect(result.edit?.versions[0]!.id).not.toBe(firstId);
  });

  it("routes through cancel and reports routing", () => {
    const { result } = withSetup(() => useComposer({ engine: fakeEngine(() => new Promise(() => {})) }));
    expect(result.routing).toBe(false);
    result.submit(payload);
    result.cancel();
    expect(result.run?.results[0]!.status).not.toBe("running");
  });

  it("stops updating once its component unmounts", async () => {
    let finish!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (finish = resolve)));
    const { result, unmount } = withSetup(() => useComposer({ engine }));
    result.submit(payload);
    unmount();
    finish({ src: "https://x/img.png", kind: "image" });
    await new Promise((r) => setTimeout(r));
    expect(result.run?.results[0]!.status).toBe("running");
  });
});

describe("useReasoning", () => {
  it("defaults to OpenRouter with the suggested models, without calling anything", () => {
    const { result } = withSetup(() => useReasoning(), {});
    expect(result.current?.model).toBe(DEFAULT_REASONING_MODEL);
    expect(result.current?.modelByKind).toEqual(DEFAULT_REASONING_MODEL_BY_KIND);
    expect(result.current?.engine.generate).toBeInstanceOf(Function);
  });

  it("merges per-kind overrides over the defaults one kind at a time", () => {
    const { result } = withSetup(() => useReasoning(), { reasoningModelByKind: { video: "qwen/qwen3.8-omni-flash" } });
    expect(result.current?.modelByKind.video).toBe("qwen/qwen3.8-omni-flash");
    expect(result.current?.modelByKind.audio).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
  });

  it("is undefined outside a provider", () => {
    const { result } = withSetup(() => useReasoning());
    expect(result.current).toBeUndefined();
  });
});

describe("useMediaAnalyzer", () => {
  it("analyzes with the provider's reasoning model, updating as the prompt arrives, and reset clears it", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "A red mug on oak.", kind: "text" });
    const { result } = withSetup(() => useMediaAnalyzer(), { reasoningEngine: fakeEngine(generate) });

    result.submit({
      attachments: [{ id: "a", kind: "image", src: "https://x/a.png" }],
      modelId: null,
      autoSelectModel: false,
      models: [],
      promptLength: null,
    });
    expect(result.analyzing).toBe(true);
    await vi.waitFor(() => expect(result.prompt).toBe("A red mug on oak."));
    expect(result.analyzing).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);

    result.reset();
    expect(result.prompt).toBeNull();
    expect(result.error).toBeNull();
  });

  it("reads options through a function, and cancel stops the analysis", () => {
    const generate = vi.fn<GenerationEngine["generate"]>(() => new Promise(() => {}));
    const { result } = withSetup(() =>
      useMediaAnalyzer(() => ({ engine: fakeEngine(generate), model: "m" }))
    );
    result.submit({
      attachments: [{ id: "a", kind: "image", src: "https://x/a.png" }],
      modelId: null,
      autoSelectModel: false,
      models: [],
      promptLength: null,
    });
    expect(generate.mock.calls[0]![0].modelId).toBe("m");
    result.cancel();
    expect(result.analyzing).toBe(false);
  });
});
