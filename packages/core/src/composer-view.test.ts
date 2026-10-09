// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EDIT_IMAGE_USE_CASE, TEXT_USE_CASE } from "./composer.js";
import {
  composerAttachmentsFromFiles,
  composerAttachMenuItems,
  composerView,
  enhanceRevealDurationMs,
} from "./composer-view.js";
import { regionColor } from "./region-edit.js";
import type { ModelOption } from "./types.js";

const IMAGE = { kind: "image" as const, label: "Image" };
const VIDEO = { kind: "video" as const, label: "Video" };
const model = (id: string, aspectRatios?: string[]): ModelOption => ({ id, label: id, provider: "p", speed: "fast", aspectRatios });
const photo = { id: "a", src: "x", kind: "image" as const };

describe("composerView", () => {
  it("runs the default use case when none is picked, and needs a prompt or an attachment", () => {
    const empty = composerView({ value: " " });
    expect(empty.activeUseCases).toEqual([TEXT_USE_CASE]);
    expect(empty.isSubmitDisabled).toBe(true);
    expect(composerView({ value: "a mug" }).isSubmitDisabled).toBe(false);
    expect(composerView({ value: "a mug" }).payload()).toMatchObject({ useCase: TEXT_USE_CASE, modelId: null, aspectRatio: null, regions: [] });
    expect(composerView({ value: "", attachments: [photo] }).isSubmitDisabled).toBe(false);
    // An app's own rule wins, except that retry always stays available.
    expect(composerView({ value: "", submitDisabled: false }).isSubmitDisabled).toBe(false);
    expect(composerView({ value: "", submitDisabled: true, submitError: "x" }).isSubmitDisabled).toBe(false);
  });

  it("words the placeholder for an edit, and needs an image plus a prompt or region", () => {
    expect(composerView({ value: "", useCase: EDIT_IMAGE_USE_CASE }).placeholder).toBe("Attach an image to edit");
    const withImage = composerView({ value: "", useCase: EDIT_IMAGE_USE_CASE, attachments: [photo] });
    expect(withImage.placeholder).toMatch(/whole image/);
    expect(withImage.isSubmitDisabled).toBe(true);
    const region = { id: "r", number: 1, box: { x: 0, y: 0, width: 1, height: 1 }, prompt: "x" };
    expect(composerView({ value: "", useCase: EDIT_IMAGE_USE_CASE, attachments: [photo], regions: [region] }).payload().regions).toEqual([region]);
    expect(composerView({ value: "x", placeholder: "Mine" }).placeholder).toBe("Mine");
  });

  it("keys the picked use cases, so a change of use case can be noticed", () => {
    expect(composerView({ value: "" }).useCaseKey).toBe("");
    expect(composerView({ value: "", useCase: IMAGE }).useCaseKey).toBe("image");
    expect(composerView({ value: "", useCase: EDIT_IMAGE_USE_CASE }).useCaseKey).toBe("image:edit");
    expect(composerView({ value: "", multiSelectUseCases: true, useCases: [IMAGE, VIDEO] }).useCaseKey).toBe("image,video");
  });

  it("shows stop only with somewhere for it to go", () => {
    expect(composerView({ value: "x", submitting: true }).showStop).toBe(false);
    expect(composerView({ value: "x", submitting: true, onAbort: () => {} }).showStop).toBe(true);
  });

  it("never picks a model for the person when there's a Model menu, and needs one to submit", () => {
    const menu = { value: "a mug", useCase: IMAGE, onModelChange: () => {} };
    const unpicked = composerView(menu);
    expect(unpicked.pickedModelIds).toEqual([]);
    expect(unpicked.modelTriggerLabel).toBe("Select model");
    expect(unpicked.isSubmitDisabled).toBe(true);
    // A pick, or auto-select, makes it ready.
    const firstSuggested = unpicked.modelSections[0]!.options[0]!.id;
    expect(composerView({ ...menu, modelId: firstSuggested }).isSubmitDisabled).toBe(false);
    const auto = composerView({ ...menu, autoSelectModel: true });
    expect([auto.isSubmitDisabled, auto.modelTriggerLabel]).toEqual([false, "Auto-select"]);
    expect(composerView({ ...menu, multiSelectModels: true, onModelIdsChange: () => {} }).modelTriggerLabel).toBe("Select models");
  });

  it("with no Model menu, runs a suggested list's first model, and passes an app's pick through", () => {
    const noMenu = composerView({ value: "a mug", useCase: IMAGE });
    expect(noMenu.pickedModelIds).toHaveLength(1);
    expect(noMenu.isSubmitDisabled).toBe(false);
    expect(composerView({ value: "x", useCase: IMAGE, models: [], modelId: "kept" }).pickedModelIds).toEqual(["kept"]);
  });

  it("drops a pick that isn't in the current list", () => {
    const gone = composerView({ value: "x", useCase: IMAGE, models: [model("a")], modelId: "gone", onModelChange: () => {} });
    expect(gone.pickedModelIds).toEqual([]);
    expect(gone.payload().modelId).toBeNull();
  });


  it("offers the model menu only with a handler for the picks", () => {
    expect(composerView({ value: "x", useCase: IMAGE }).canPickModel).toBe(false);
    expect(composerView({ value: "x", useCase: IMAGE, onModelChange: () => {} }).canPickModel).toBe(true);
    expect(composerView({ value: "x", useCase: IMAGE, multiSelectModels: true, onModelIdsChange: () => {} }).canPickModel).toBe(true);
  });

  it("toggles multi-select picks, and labels several", () => {
    const view = composerView({ value: "x", useCase: IMAGE, models: [model("a"), model("b")], multiSelectModels: true, modelIds: ["a", "b"] });
    expect(view.modelTriggerLabel).toBe("2 models");
    expect(view.toggledModelIds("a")).toEqual(["b"]);
    expect(composerView({ value: "x", multiSelectModels: true, modelIds: ["a"] }).toggledModelIds("c")).toEqual(["a", "c"]);
  });

  it("splits picks by use case with multi-use-case select", () => {
    const view = composerView({
      value: "x",
      multiSelectUseCases: true,
      useCases: [IMAGE, VIDEO],
      modelsByKind: { image: [model("img")], video: [model("vid")] },
      modelIds: ["img", "vid"],
    });
    expect(view.modelSections.map((s) => s.label)).toEqual(["Image", "Video"]);
    expect(view.payload().selections.map((s) => s.modelIds)).toEqual([["img"], ["vid"]]);
  });

  it("offers only aspect ratios every model that might run takes, and never sends one they don't", () => {
    const models = [model("sw", ["1:1", "16:9"]), model("wt", ["16:9", "9:16"])];
    expect(composerView({ value: "x", useCase: IMAGE, models }).aspectOptions.map((o) => o.value)).toEqual(["16:9"]);
    const picked = composerView({ value: "x", useCase: IMAGE, models, modelId: "sw", aspectRatio: "9:16" });
    expect(picked.aspectOptions.map((o) => o.value)).toEqual(["1:1", "16:9"]);
    expect(picked.offeredAspect).toBeNull();
    const labeled = composerView({ value: "x", useCase: IMAGE, models, modelId: "sw", aspectRatio: "1:1", aspectRatios: [{ value: "1:1", label: "Square" }] });
    expect(labeled.selectedAspect?.label).toBe("Square");
    expect(labeled.payload().aspectRatio).toBe("1:1");
    expect(composerView({ value: "x", useCase: EDIT_IMAGE_USE_CASE }).showAspectRatio).toBe(false);
  });
});

describe("Composer helpers", () => {
  it("lists the + menu items that can work", () => {
    expect(composerAttachMenuItems(undefined, { canAddMedia: true, canSelect: false }).map((i) => i.action)).toEqual(["add-media"]);
    expect(composerAttachMenuItems(["edit-media"], { canAddMedia: true, canSelect: true }).map((i) => i.action)).toEqual(["edit-media"]);
  });

  it("adds picked files in order, and in an edit replaces the image with the first one picked", async () => {
    const png = new File(["x"], "a.png", { type: "image/png" });
    const mp4 = new File(["x"], "b.mp4", { type: "video/mp4" });
    const added = await composerAttachmentsFromFiles([png, mp4], [{ ...photo, name: "old" }], false);
    expect(added.attachments!.map((a) => a.name)).toEqual(["old", "a.png", "b.mp4"]);
    const edit = await composerAttachmentsFromFiles([mp4, png], [photo], true);
    expect(edit.attachments!.map((a) => a.name)).toEqual(["a.png"]);
    expect(await composerAttachmentsFromFiles([mp4], [photo], true)).toEqual({ attachments: null, unsupported: ["b.mp4"] });
  });

  it("cycles region colors and bounds the reveal time", () => {
    expect(regionColor(1)).toBe("var(--chai-color-semantic-region-1)");
    expect(regionColor(7)).toBe("var(--chai-color-semantic-region-1)");
    expect([enhanceRevealDurationMs(10), enhanceRevealDurationMs(100), enhanceRevealDurationMs(1000)]).toEqual([300, 600, 900]);
  });
});
