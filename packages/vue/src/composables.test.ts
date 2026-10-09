// The behavior lives in `@chai-ui/core` (composer.test.ts,
// media-analyzer.test.ts). These cover what the Vue binding adds: reactive
// state, the provider, and options read through a getter.
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, type Component } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { ComposerSubmitPayload, DroppedMedia, GenerationEngine } from "@chai-ui/core";
import { DEFAULT_REASONING_MODEL, DEFAULT_REASONING_MODEL_BY_KIND } from "@chai-ui/core";
import ChaiProvider from "./ChaiProvider.vue";
import { useReasoning } from "./reasoning.js";
import { useComposer } from "./useComposer.js";
import { useMediaAnalyzer } from "./useMediaAnalyzer.js";

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

/** Runs `use` in a component's setup, optionally inside a ChaiProvider, and returns what it returned. */
function withSetup<T>(use: () => T, provider?: Record<string, unknown>) {
  let result!: T;
  const Child = defineComponent({
    setup() {
      result = use();
      return () => null;
    },
  });
  const wrapper = mount(
    provider ? defineComponent(() => () => h(ChaiProvider as Component, provider, () => h(Child))) : Child
  );
  return { result, wrapper };
}

describe("useComposer", () => {
  it("updates its refs as the run moves from running to done", async () => {
    let finish!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (finish = resolve)));
    const { result } = withSetup(() => useComposer({ engine }));

    result.submit(payload);
    expect(result.run.value?.results[0]!.status).toBe("running");
    finish({ src: "https://x/img.png", kind: "image" });
    await vi.waitFor(() => expect(result.run.value?.results[0]!.status).toBe("done"));
  });

  it("leaves enhance undefined until both reasoningEngine and reasoningModel are set", () => {
    const engine = fakeEngine(async () => ({ src: "x", kind: "text" as const }));
    const options = ref<{ reasoningEngine?: GenerationEngine; reasoningModel?: string }>({});
    const { result } = withSetup(() => useComposer(options));
    expect(result.enhance.value).toBeUndefined();
    options.value = { reasoningEngine: engine };
    expect(result.enhance.value).toBeUndefined();
    options.value = { reasoningEngine: engine, reasoningModel: "m" };
    expect(result.enhance.value).toBeInstanceOf(Function);
  });

  it("enhance uses the provider's pair and toggles `enhancing`", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "rewritten", kind: "text" });
    const { result } = withSetup(() => useComposer(), { reasoningEngine: fakeEngine(generate) });
    const pending = result.enhance.value!("a mug");
    expect(result.enhancing.value).toBe(true);
    expect(await pending).toBe("rewritten");
    expect(result.enhancing.value).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);
  });

  it("half a pair never borrows the provider's other half", () => {
    const { result } = withSetup(() => useComposer({ reasoningModel: "hook-model" }), {
      reasoningEngine: fakeEngine(vi.fn()),
    });
    expect(result.enhance.value).toBeUndefined();
  });

  it("starts the edit over as soon as the image changes", async () => {
    const image = ref<DroppedMedia>({ src: "data:image/png;base64,AAA", kind: "image" });
    const generate = vi.fn().mockResolvedValue({ src: "https://x/e.png", kind: "image" as const });
    const { result } = withSetup(() => useComposer(() => ({ engine: fakeEngine(generate), editImage: image.value })));
    const useCase = { kind: "image" as const, label: "Edit image", edit: true };
    result.submit({ ...payload, value: "x", useCase, selections: [{ useCase, modelIds: ["m"], models: [] }] });
    await vi.waitFor(() => expect(result.edit.value?.versions).toHaveLength(2));

    const firstId = result.edit.value?.versions[0]!.id;
    image.value = { src: "data:image/png;base64,BBB", kind: "image" };
    expect(result.edit.value?.versions).toHaveLength(1);
    expect(result.edit.value?.versions[0]!.id).not.toBe(firstId);
  });

  it("stops updating once its component unmounts", async () => {
    let finish!: (v: { src: string; kind: "image" }) => void;
    const engine = fakeEngine(() => new Promise((resolve) => (finish = resolve)));
    const { result, wrapper } = withSetup(() => useComposer({ engine }));
    result.submit(payload);
    wrapper.unmount();
    finish({ src: "https://x/img.png", kind: "image" });
    await nextTick();
    expect(result.run.value?.results[0]!.status).toBe("running");
  });
});

describe("ChaiProvider", () => {
  it("defaults to OpenRouter with the suggested models, without calling anything", () => {
    const { result } = withSetup(() => useReasoning(), {});
    expect(result.value?.model).toBe(DEFAULT_REASONING_MODEL);
    expect(result.value?.modelByKind).toEqual(DEFAULT_REASONING_MODEL_BY_KIND);
    expect(result.value?.engine.generate).toBeInstanceOf(Function);
  });

  it("merges per-kind overrides over the defaults one kind at a time", () => {
    const { result } = withSetup(() => useReasoning(), { reasoningModelByKind: { video: "qwen/qwen3.8-omni-flash" } });
    expect(result.value?.modelByKind.video).toBe("qwen/qwen3.8-omni-flash");
    expect(result.value?.modelByKind.audio).toBe(DEFAULT_REASONING_MODEL_BY_KIND.audio);
  });

  it("is undefined outside a provider", () => {
    const { result } = withSetup(() => useReasoning());
    expect(result.value).toBeUndefined();
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
    expect(result.analyzing.value).toBe(true);
    await vi.waitFor(() => expect(result.prompt.value).toBe("A red mug on oak."));
    expect(result.analyzing.value).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);

    result.reset();
    expect(result.prompt.value).toBeNull();
    expect(result.error.value).toBeNull();
  });
});
