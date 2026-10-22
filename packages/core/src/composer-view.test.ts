// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CREATE_MUSIC_USE_CASE, CREATE_SPEECH_USE_CASE, EDIT_IMAGE_USE_CASE, TEXT_USE_CASE } from "./composer.js";
import {
  composerAttachmentsFromFiles,
  composerAttachMenuItems,
  composerView,
  enhanceRevealDurationMs,
  nextUseCases,
} from "./composer-view.js";
import { regionColor } from "./region-edit.js";
import { SUGGESTED_IMAGE_MODELS, SUGGESTED_TEXT_TO_VIDEO_MODELS } from "./suggested-models.js";
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

  it("keeps each use case's models and Aspect ratio with images attached", () => {
    const handlers = { onModelChange: () => {}, onModelIdsChange: () => {} };
    const image = composerView({ value: "x", attachments: [photo], useCase: IMAGE, ...handlers });
    expect(image.modelMenus[0]!.options).toEqual(SUGGESTED_IMAGE_MODELS);
    expect(image.aspectOptions.length).toBeGreaterThan(0);
    for (const m of SUGGESTED_TEXT_TO_VIDEO_MODELS) {
      const video = composerView({ value: "x", attachments: [photo], useCase: VIDEO, modelId: m.id, ...handlers });
      expect(video.modelMenus[0]!.options).toEqual(SUGGESTED_TEXT_TO_VIDEO_MODELS);
      expect(video.aspectOptions.map((o) => o.value)).toEqual(m.aspectRatios);
    }
    // Edit image keeps the image's shape, though its models take ratios.
    expect(composerView({ value: "x", attachments: [photo], useCase: EDIT_IMAGE_USE_CASE, ...handlers }).showAspectRatio).toBe(false);
  });
});

describe("Composer helpers", () => {
  it("lists the + menu items that can work", () => {
    expect(composerAttachMenuItems(undefined, { canAddMedia: true, canSelect: false }).map((i) => i.action)).toEqual(["add-media"]);
    expect(composerAttachMenuItems(["edit-image"], { canAddMedia: true, canSelect: true }).map((i) => i.action)).toEqual(["edit-image"]);
  });

  it("shows Create speech and Create music only when the builder lists them", () => {
    const all = { canAddMedia: true, canSelect: true };
    const actions = composerAttachMenuItems(undefined, all).map((i) => i.action);
    expect(actions).not.toContain("create-speech");
    expect(actions).not.toContain("create-music");
  });

  it("draws a divider only between two groups that both show", () => {
    const all = { canAddMedia: true, canSelect: true };
    const dividers = (actions?: Parameters<typeof composerAttachMenuItems>[0]) =>
      composerAttachMenuItems(actions, all).filter((i) => i.divider).map((i) => i.action);
    // Attach | visual | audio.
    expect(dividers(["add-media", "create-image", "edit-image", "create-speech", "create-music"])).toEqual(["add-media", "edit-image"]);
    // Edit image hidden: the visual group's last showing item takes the divider.
    expect(dividers(["create-image", "create-video", "create-music"])).toEqual(["create-video"]);
    // No audio: nothing after the visual group, so no divider dangles.
    expect(dividers(["add-media", "create-image", "edit-image"])).toEqual(["add-media"]);
  });

  it("shows Create world only when the builder lists it", () => {
    const all = { canAddMedia: true, canSelect: true };
    expect(composerAttachMenuItems(undefined, all).map((i) => i.action)).not.toContain("create-world");
    expect(composerAttachMenuItems(["create-image", "create-world"], all).map((i) => i.action)).toEqual(["create-image", "create-world"]);
  });

  it("needs a world's environment, sends its character and only a frame rate the models share", () => {
    const WORLD = { kind: "world" as const, label: "World" };
    const a = { ...model("a"), frameRates: [16, 24] };
    const b = { ...model("b"), frameRates: [24, 60] };
    const blocked = composerView({ value: "", character: "a parrot", attachments: [photo], useCase: WORLD });
    expect(blocked.isSubmitDisabled).toBe(true);
    expect(blocked.environmentHint).toBe("Add an environment to create a world");
    expect(blocked.placeholder).toMatch(/how to use the attached media/);
    // Nothing to send yet: no hint.
    expect(composerView({ value: "", useCase: WORLD }).environmentHint).toBeNull();
    const view = composerView({ value: "a temple", character: "a parrot", useCase: WORLD, models: [a, b], frameRate: 16 });
    expect(view.world).toBe(true);
    expect(view.frameRateOptions).toEqual([24]);
    expect(view.payload()).toMatchObject({ value: "a temple", character: "a parrot", frameRate: null });
    expect(composerView({ value: "a temple", useCase: WORLD, models: [a, b], frameRate: 24 }).payload().frameRate).toBe(24);
    // Other use cases send neither.
    expect(composerView({ value: "a mug", character: "x", useCase: IMAGE }).payload()).not.toHaveProperty("character");
  });

  it("tells Enhance the use case on screen: text with none picked, vision with media, an edit while editing", () => {
    expect(composerView({ value: "hi" }).enhanceMode).toBe("text-to-text");
    expect(composerView({ value: "hi", attachments: [photo] }).enhanceMode).toBe("vision");
    expect(composerView({ value: "hi", useCase: VIDEO }).enhanceMode).toBe("text-to-video");
    expect(composerView({ value: "hi", useCase: EDIT_IMAGE_USE_CASE, attachments: [photo] }).enhanceMode).toBe("image-edit");
    expect(composerView({ value: "hi", useCase: CREATE_SPEECH_USE_CASE }).enhanceMode).toBe("text-to-speech");
    expect(composerView({ value: "hi", useCase: CREATE_MUSIC_USE_CASE }).enhanceMode).toBe("text-to-music");
  });

  it("offers the one picked speech model's voices, in sections when grouped, and sends only an offered voice", () => {
    const kokoro = { ...model("kokoro"), voices: [{ value: "af_heart", label: "Heart", group: "Female" }, { value: "am_adam", label: "Adam", group: "Male" }] };
    const xai = { ...model("xai"), voices: [{ value: "eve", label: "Eve" }] };
    const base = { value: "hi", useCase: CREATE_SPEECH_USE_CASE, models: [kokoro, xai], onModelChange: () => {} };
    // No model picked yet: no Voice menu.
    expect(composerView(base).voiceOptions).toEqual([]);
    const picked = composerView({ ...base, modelId: "kokoro", speechVoice: "am_adam" });
    expect(picked.voiceSections?.map((s) => s.label)).toEqual(["Female", "Male"]);
    expect(picked.voiceTriggerLabel).toBe("Adam");
    expect(picked.payload().speechVoice).toBe("am_adam");
    // Another model's voice is shown as unpicked and never sent.
    const other = composerView({ ...base, modelId: "xai", speechVoice: "am_adam" });
    expect(other.voiceSections).toBeNull();
    expect(other.voiceTriggerLabel).toBe("Voice");
    expect(other.payload().speechVoice).toBeNull();
    // Auto-select: no model to take voices from.
    expect(composerView({ ...base, autoSelectModel: true }).voiceOptions).toEqual([]);
  });

  it("offers the genres every picked music model lists, several at once", () => {
    const pop = { value: "pop", label: "Pop" };
    const jazz = { value: "jazz", label: "Jazz" };
    const a = { ...model("a"), genres: [pop, jazz] };
    const b = { ...model("b"), genres: [jazz] };
    const base = { value: "rainy night", useCase: CREATE_MUSIC_USE_CASE, models: [a, b], multiSelectModels: true, onModelIdsChange: () => {} };
    expect(composerView(base).genreOptions).toEqual([]);
    const one = composerView({ ...base, modelIds: ["a"], genres: ["pop", "jazz"] });
    expect(one.genreTriggerLabel).toBe("2 genres");
    expect(one.toggledGenres("pop")).toEqual(["jazz"]);
    expect(one.payload().genres).toEqual(["pop", "jazz"]);
    const both = composerView({ ...base, modelIds: ["a", "b"], genres: ["pop", "jazz"] });
    expect(both.genreOptions).toEqual([jazz]);
    expect(both.genreTriggerLabel).toBe("Jazz");
    expect(both.payload().genres).toEqual(["jazz"]);
    // Speech sends no genres, music no voice.
    expect(one.payload()).not.toHaveProperty("speechVoice");
  });

  it("combines only Image and Video: any other use case runs alone", () => {
    const WORLD = { kind: "world" as const, label: "World" };
    expect(nextUseCases([IMAGE], VIDEO)).toEqual([IMAGE, VIDEO]);
    expect(nextUseCases([IMAGE, VIDEO], { kind: "video", label: "Clip" })).toEqual([IMAGE, { kind: "video", label: "Clip" }]);
    for (const alone of [CREATE_MUSIC_USE_CASE, CREATE_SPEECH_USE_CASE, EDIT_IMAGE_USE_CASE, WORLD]) {
      expect(nextUseCases([IMAGE, VIDEO], alone)).toEqual([alone]);
      expect(nextUseCases([alone], IMAGE)).toEqual([IMAGE]);
    }
    // A builder's list that breaks the rule runs only its last pick.
    const view = composerView({ value: "x", multiSelectUseCases: true, useCases: [IMAGE, CREATE_MUSIC_USE_CASE] });
    expect(view.pickedUseCases).toEqual([CREATE_MUSIC_USE_CASE]);
    expect(view.payload().selections.map((s) => s.useCase)).toEqual([CREATE_MUSIC_USE_CASE]);
  });

  it("gives each use case its own Model menu, one pick each unless several are allowed", () => {
    const both = {
      value: "x",
      multiSelectUseCases: true,
      useCases: [IMAGE, VIDEO],
      modelsByKind: { image: [model("img"), model("img2")], video: [model("vid")] },
      onModelIdsChange: () => {},
    };
    const none = composerView(both);
    expect(none.modelMenus.map((m) => [m.triggerLabel, m.multiple, m.value])).toEqual([
      ["Image model", false, null],
      ["Video model", false, null],
    ]);
    // A pick in one menu replaces that use case's pick only.
    const picked = composerView({ ...both, modelIds: ["img", "vid"] });
    expect(picked.modelMenus.map((m) => m.triggerLabel)).toEqual(["img", "vid"]);
    expect(picked.modelMenus[0]!.next("img2")).toEqual(["vid", "img2"]);
    // With multiSelectModels too, each menu toggles.
    const several = composerView({ ...both, multiSelectModels: true, modelIds: ["img", "img2", "vid"] });
    expect(several.modelMenus.map((m) => [m.triggerLabel, m.menuLabel])).toEqual([
      ["2 models", "Image models"],
      ["vid", "Video models"],
    ]);
    expect(several.modelMenus[0]!.next("img")).toEqual(["img2", "vid"]);
    // No auto-select with multi-use-case select: each model is picked by hand.
    const forced = composerView({ ...both, autoSelectModel: true });
    expect(forced.modelMenus.map((m) => m.triggerLabel)).toEqual(["Image model", "Video model"]);
    expect([forced.autoSelectModel, forced.offersAutoSelect, forced.payload().autoSelectModel]).toEqual([false, false, false]);
  });

  it("needs a model for every use case before a submit, never running an engine default", () => {
    const both = {
      value: "x",
      multiSelectUseCases: true,
      useCases: [IMAGE, VIDEO],
      modelsByKind: { image: [model("img")], video: [model("vid")] },
      onModelIdsChange: () => {},
    };
    expect(composerView({ ...both, modelIds: ["img"] }).isSubmitDisabled).toBe(true);
    expect(composerView({ ...both, modelIds: ["img", "vid"] }).isSubmitDisabled).toBe(false);
    expect(composerView({ ...both, autoSelectModel: true }).isSubmitDisabled).toBe(true);
  });

  it("gives speech and music their own placeholder, no aspect ratio, no suggested models, and a use-case key each", () => {
    const speech = composerView({ value: "", useCase: CREATE_SPEECH_USE_CASE, onModelChange: () => {} });
    const music = composerView({ value: "", useCase: CREATE_MUSIC_USE_CASE, onModelChange: () => {} });
    expect(speech.placeholder).toBe("Type the words to speak");
    expect(music.placeholder).toBe("Describe the music to create");
    expect(speech.showAspectRatio).toBe(false);
    expect(speech.modelSections).toEqual([]);
    expect(speech.useCaseKey).not.toBe(music.useCaseKey);
  });

  it("gives a world use case no suggested models and no aspect ratio", () => {
    const view = composerView({ value: "a meadow", useCase: { kind: "world", label: "World" }, onModelChange: () => {} });
    expect(view.modelSections).toEqual([]);
    expect(view.showAspectRatio).toBe(false);
    expect(view.isSubmitDisabled).toBe(false);
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
