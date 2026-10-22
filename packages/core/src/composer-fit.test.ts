import { describe, expect, it, vi } from "vitest";
import { createComposerStore, type ComposerOptions, type ComposerSubmitPayload } from "./composer.js";
import type { GenerationEngine } from "./engine.js";
import type { DroppedMedia } from "./types.js";

let fitting: Promise<void> = Promise.resolve();
vi.mock("./image-fit.js", () => ({
  fitImagesToRatio: vi.fn(async (attachments: DroppedMedia[], ratio: string, fit: string) => {
    await fitting;
    return attachments.map((a) => ({ ...a, src: `${a.src}@${ratio}:${fit}` }));
  }),
}));

const photo: DroppedMedia = { src: "photo", kind: "image" };
const VIDEO = { kind: "video" as const, label: "Video" };
const IMAGE = { kind: "image" as const, label: "Image" };

function submitWith(options: ComposerOptions, useCase = VIDEO, aspectRatio: string | null = "16:9") {
  const store = createComposerStore(() => options, () => undefined);
  const payload: ComposerSubmitPayload = {
    value: "it lifts off",
    attachments: [photo],
    aspectRatio,
    useCase,
    modelId: "m",
    autoSelectModel: false,
    regions: [],
    selections: [{ useCase, modelIds: ["m"], models: [] }],
  };
  store.submit(payload);
  return store;
}

describe("a video's start image and the picked ratio", () => {
  it("fits the start image to the ratio before the engine runs, cropping by default", async () => {
    const generate = vi.fn<GenerationEngine["generate"]>(async () => ({ src: "v.mp4", kind: "video" }));
    submitWith({ engine: { generate } });
    expect(generate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0]![0]).toMatchObject({ attachments: [{ src: "photo@16:9:crop", kind: "image" }], aspectRatio: "16:9" });
  });

  it("pads instead with startImageFit", async () => {
    const generate = vi.fn<GenerationEngine["generate"]>(async () => ({ src: "v.mp4", kind: "video" }));
    submitWith({ engine: { generate }, startImageFit: "pad" });
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0]![0].attachments).toEqual([{ src: "photo@16:9:pad", kind: "image" }]);
  });

  it("goes straight to the engine for an image, or a video with no ratio", () => {
    const generate = vi.fn<GenerationEngine["generate"]>(async () => ({ src: "x", kind: "image" }));
    submitWith({ engine: { generate } }, IMAGE);
    submitWith({ engine: { generate } }, VIDEO, null);
    expect(generate.mock.calls.map((c) => c[0].attachments)).toEqual([[photo], [photo]]);
  });

  it("never calls the engine when cancelled while the image is being fitted", async () => {
    let finishFitting!: () => void;
    fitting = new Promise((resolve) => (finishFitting = resolve));
    const generate = vi.fn<GenerationEngine["generate"]>(async () => ({ src: "v.mp4", kind: "video" }));
    const store = submitWith({ engine: { generate } });
    store.cancel();
    finishFitting();
    await vi.waitFor(() => expect(store.getState().runs[0]!.results[0]!.status).toBe("cancelled"));
    expect(generate).not.toHaveBeenCalled();
    fitting = Promise.resolve();
  });
});
