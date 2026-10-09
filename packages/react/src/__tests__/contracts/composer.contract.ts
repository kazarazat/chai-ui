import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  EDIT_IMAGE_USE_CASE,
  TEXT_USE_CASE,
  type ComposerAttachment,
  type ComposerSubmitPayload,
  type ComposerUseCase,
  type EditRegion,
  type ModelOption,
} from "@chai-ui/core";
import { wcagViolations } from "../axe.js";
import { controlled, type Render } from "./render.js";

/** React-shaped Composer props; the Vue side maps the `on…Change` ones to `v-model` events. */
export type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: ComposerSubmitPayload) => void;
} & Record<string, unknown>;

const IMAGE = { kind: "image" as const, label: "Image" };
const VIDEO = { kind: "video" as const, label: "Video" };
const MODELS: ModelOption[] = [
  { id: "fal/fast", label: "Fast Image", provider: "fal", speed: "fast" },
  { id: "fal/pro", label: "Pro Image", provider: "fal", speed: "standard" },
];
const SQUARE_WIDE: ModelOption = { id: "fal/sw", label: "Square and wide", provider: "fal", speed: "fast", aspectRatios: ["1:1", "16:9"] };
const WIDE_TALL: ModelOption = { id: "fal/wt", label: "Wide and tall", provider: "fal", speed: "fast", aspectRatios: ["16:9", "9:16"] };
const OWN_SHAPE: ModelOption = { id: "fal/own", label: "Own shape", provider: "fal", speed: "fast" };
const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#09f"/></svg>')}`;
const fileInput = () => document.querySelector<HTMLInputElement>('.chai-composer input[type="file"]')!;
const file = (name: string, type: string) => new File(["x"], name, { type });
const region = (number: number): EditRegion => ({
  id: `r${number}`,
  number,
  box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  prompt: `change ${number}`,
});

export function composerContract(render: Render<ComposerProps>) {
  /**
   * A Composer whose parent holds its prompt text (and, with `holdAttachments`,
   * its attachments), as an app would. Pickers only show with somewhere for a
   * pick to go, so they get handlers.
   */
  const harness = (props: Record<string, unknown> = {}, { holdAttachments = false } = {}) =>
    controlled<ComposerProps>(
      render,
      {
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        onModelChange: () => {},
        onModelIdsChange: () => {},
        onAspectRatioChange: () => {},
        ...(holdAttachments && { attachments: [], onAttachmentsChange: () => {} }),
        ...props,
      },
      holdAttachments ? { onChange: "value", onAttachmentsChange: "attachments" } : { onChange: "value" }
    );

  describe("Composer", () => {
    it("submits the typed prompt as a text request when no use case is picked", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ onSubmit });
      await userEvent.fill(screen.getByRole("textbox"), "a red mug");
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "a red mug",
          useCase: TEXT_USE_CASE,
          modelId: null,
          autoSelectModel: false,
          selections: [{ useCase: TEXT_USE_CASE, modelIds: [], models: [] }],
        })
      );
    });

    it("sends the picked model and the offered models", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, models: MODELS, modelId: "fal/pro", onSubmit });
      await expect.element(screen.getByText("Pro Image")).toBeVisible();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0].selections).toEqual([{ useCase: IMAGE, modelIds: ["fal/pro"], models: MODELS }]);
    });

    it("turning auto-select on clears the pick and reads Auto-select until routing picks", async () => {
      const onModelChange = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, models: MODELS, modelId: "fal/pro", autoSelectModel: false, onModelChange });
      await screen.rerender({ autoSelectModel: true });
      await expect.poll(() => onModelChange.mock.calls).toEqual([[null]]);
      await screen.rerender({ modelId: null });
      await expect.element(screen.getByText("Auto-select")).toBeVisible();
    });

    it("turning auto-select off leaves the pick alone", async () => {
      const onModelChange = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, models: MODELS, modelId: "fal/pro", autoSelectModel: true, onModelChange });
      await screen.rerender({ autoSelectModel: false });
      await expect.element(screen.getByText("Pro Image")).toBeVisible();
      expect(onModelChange).not.toHaveBeenCalled();
    });

    it("removes a single picked use case from its chip with onClearUseCase", async () => {
      const onClearUseCase = vi.fn();
      const screen = harness({ useCase: IMAGE, onClearUseCase });
      await screen.getByText("Image", { exact: true }).hover();
      await screen.getByRole("button", { name: "Remove Image" }).click();
      expect(onClearUseCase).toHaveBeenCalledTimes(1);
    });

    it("shows a use-case chip without a remove button when it can't be removed", async () => {
      const screen = harness({ useCase: IMAGE });
      await expect.element(screen.getByText("Image", { exact: true })).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Remove Image" })).not.toBeInTheDocument();
    });

    it("shows a stop button while submitting, wired to onAbort", async () => {
      const onAbort = vi.fn();
      const screen = harness({ value: "a mug", submitting: true, onAbort });
      await screen.getByRole("button", { name: "Stop" }).click();
      expect(onAbort).toHaveBeenCalledTimes(1);
    });

    it("shows a failed submit's message and retries with the same payload", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ value: "a mug", submitError: "The model timed out.", onSubmit });
      await expect.element(screen.getByRole("alert")).toHaveTextContent("The model timed out.");
      await screen.getByRole("button", { name: "Retry" }).click();
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ value: "a mug" }));
    });
  });

  describe("Composer prompt optimization", () => {
    /** An app whose Enhance rewrites the prompt to `rewrite` after a moment. */
    function enhancing(rewrite: string) {
      const screen = harness({
        value: "a mug",
        enhancing: false,
        onEnhance: () => {
          screen.rerender({ enhancing: true });
          setTimeout(() => screen.rerender({ value: rewrite, enhancing: false }), 20);
        },
      });
      return screen;
    }

    it("optimize then undo restores the original prompt", async () => {
      const rewrite = "a red ceramic mug on oak, ".repeat(12); // past the reveal's length cap, so no animation
      const screen = enhancing(rewrite);
      await screen.getByRole("button", { name: "Optimize prompt" }).click();
      await expect.element(screen.getByRole("textbox")).toHaveValue(rewrite);
      await screen.getByRole("button", { name: "Revert to original prompt" }).click();
      await expect.element(screen.getByRole("textbox")).toHaveValue("a mug");
      await expect.element(screen.getByRole("button", { name: "Optimize prompt" })).toBeVisible();
    });

    it("reveals a short rewrite, then undo restores the original", async () => {
      const screen = enhancing("a red ceramic mug on oak");
      await screen.getByRole("button", { name: "Optimize prompt" }).click();
      // While the rewrite is revealed, a decorative copy paints the text in.
      await expect.poll(() => document.querySelector(".chai-composer__reveal")).not.toBeNull();
      await expect.poll(() => document.querySelector(".chai-composer__reveal")).toBeNull();
      await expect.element(screen.getByRole("textbox")).toHaveValue("a red ceramic mug on oak");
      await screen.getByRole("button", { name: "Revert to original prompt" }).click();
      await expect.element(screen.getByRole("textbox")).toHaveValue("a mug");
    });
  });

  describe("Composer editing an image", () => {
    const photo = { id: "a1", src: "data:image/png;base64,AAA", kind: "image" as const };

    it("asks for an image first, and won't submit without one", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ useCase: EDIT_IMAGE_USE_CASE, value: "make it night", onSubmit });
      await expect.element(screen.getByRole("textbox", { name: "Attach an image to edit" })).toBeInTheDocument();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submits regions without a whole-image prompt, and hides aspect ratio", async () => {
      const onSubmit = vi.fn();
      const screen = harness({
        useCase: EDIT_IMAGE_USE_CASE,
        attachments: [photo],
        regions: [region(1)],
        aspectRatios: [{ value: "1:1", label: "1:1" }],
        onSubmit,
      });
      await expect.element(screen.getByRole("textbox", { name: /whole image/ })).toBeInTheDocument();
      await expect.element(screen.getByText("Aspect ratio")).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0].regions).toEqual([region(1)]);
    });

    it("needs a prompt or a region", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ useCase: EDIT_IMAGE_USE_CASE, attachments: [photo], onSubmit });
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shows a chip per region and removes a region from its chip", async () => {
      const onRegionsChange = vi.fn();
      const screen = harness({ useCase: EDIT_IMAGE_USE_CASE, attachments: [photo], regions: [region(1), region(2)], onRegionsChange });
      await expect.element(screen.getByText("Region 2")).toBeVisible();
      // The remove button appears on hover, as with the use-case chip.
      await screen.getByText("Region 1").hover();
      await screen.getByRole("button", { name: "Remove Region 1" }).click();
      expect(onRegionsChange).toHaveBeenCalledWith([region(2)]);
    });

    it("shows no region chips outside an edit", async () => {
      const screen = harness({ useCase: IMAGE, regions: [region(1)] });
      await expect.element(screen.getByText("Region 1")).not.toBeInTheDocument();
    });

    it("a new image replaces the one being edited", async () => {
      const onAttachmentsChange = vi.fn();
      harness(
        { useCase: EDIT_IMAGE_USE_CASE, attachments: [{ id: "old", src: "data:image/png;base64,old", kind: "image", name: "old.png" }], onAttachmentsChange },
        { holdAttachments: true }
      );
      // One image at a time: the picker takes a single image file.
      expect(fileInput().multiple).toBe(false);
      expect(fileInput().accept).toBe("image/*");
      await userEvent.upload(fileInput(), file("new.png", "image/png"));
      await expect.poll(() => onAttachmentsChange.mock.calls.at(-1)?.[0].map((a: ComposerAttachment) => a.name)).toEqual(["new.png"]);
    });

    it("reports a file that isn't an image and keeps the current one", async () => {
      const onUnsupportedFile = vi.fn();
      const onAttachmentsChange = vi.fn();
      harness({
        useCase: EDIT_IMAGE_USE_CASE,
        attachments: [{ id: "old", src: "data:image/png;base64,old", kind: "image", name: "old.png" }],
        onAttachmentsChange,
        onUnsupportedFile,
      });
      await userEvent.upload(fileInput(), file("clip.mp4", "video/mp4"));
      await expect.poll(() => onUnsupportedFile.mock.calls).toEqual([["clip.mp4"]]);
      expect(onAttachmentsChange).not.toHaveBeenCalled();
    });
  });

  describe("Composer attach menu", () => {
    it("opens, lists the actions, reports a pick and closes", async () => {
      const onAttachMenuSelect = vi.fn();
      const screen = harness({ onAttachMenuSelect, onAttachmentsChange: () => {} });
      await screen.getByRole("button", { name: "Add media" }).click();
      for (const item of ["Add media", "Create image", "Create video", "Edit image"]) {
        await expect.element(screen.getByRole("menuitem", { name: item })).toBeVisible();
      }
      await screen.getByRole("menuitem", { name: "Create video" }).click();
      expect(onAttachMenuSelect).toHaveBeenCalledWith("create-video");
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    });

    it("closes on Escape and on a click outside", async () => {
      // No text of its own: the screen's queries find the page partly by its text.
      const outside = document.body.appendChild(Object.assign(document.createElement("button"), { ariaLabel: "Outside" }));
      outside.style.cssText = "width: 24px; height: 24px";
      try {
        const screen = harness({ onAttachMenuSelect: () => {} });
        await screen.getByRole("button", { name: "Add media" }).click();
        await userEvent.keyboard("{Escape}");
        await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();

        await screen.getByRole("button", { name: "Add media" }).click();
        await expect.element(screen.getByRole("button", { name: "Close attach menu" })).toBeVisible();
        await userEvent.click(outside);
        await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
      } finally {
        outside.remove();
      }
    });

    it("hides the + menu when nothing in it is wired, and shows only the items asked for", async () => {
      const bare = harness();
      await expect.element(bare.getByRole("button", { name: "Add media" })).not.toBeInTheDocument();
      bare.unmount();

      const narrowed = harness({ onAttachMenuSelect: () => {}, onAttachmentsChange: () => {}, attachMenuActions: ["add-media", "edit-media"] });
      await narrowed.getByRole("button", { name: "Add media" }).click();
      await expect.element(narrowed.getByRole("menuitem", { name: "Edit image" })).toBeVisible();
      await expect.element(narrowed.getByRole("menuitem", { name: "Create video" })).not.toBeInTheDocument();
    });
  });

  describe("Composer attachments", () => {
    it("reads picked files by kind and reports unsupported ones", async () => {
      const onUnsupportedFile = vi.fn();
      const screen = harness({ onUnsupportedFile }, { holdAttachments: true });
      await userEvent.upload(fileInput(), [file("photo.png", "image/png"), file("clip.mp4", "video/mp4"), file("notes.txt", "text/plain")]);
      await expect.element(screen.getByRole("button", { name: "Remove attachment" }).nth(1)).toBeInTheDocument();
      expect(onUnsupportedFile).toHaveBeenCalledWith("notes.txt");
      // An image shows as a thumbnail; other kinds show their icon.
      expect(document.querySelectorAll(".chai-composer__thumb-img")).toHaveLength(1);
      expect(document.querySelectorAll(".chai-composer__thumb-icon")).toHaveLength(1);
    });

    it("removes an attachment from its thumbnail", async () => {
      const onAttachmentsChange = vi.fn();
      const attachments: ComposerAttachment[] = [
        { id: "a", src: "data:audio/mpeg;base64,AA", kind: "audio", name: "a.mp3" },
        { id: "v", src: "data:video/mp4;base64,AA", kind: "video", name: "v.mp4" },
      ];
      const screen = harness({ attachments, onAttachmentsChange });
      await screen.getByRole("button", { name: "Remove attachment" }).first().click();
      expect(onAttachmentsChange).toHaveBeenCalledWith([attachments[1]]);
    });

    it("shows no add or remove controls when there's nowhere to put files", async () => {
      const attachments: ComposerAttachment[] = [{ id: "a", src: "data:image/png;base64,x", kind: "image", name: "a.png" }];
      const screen = harness({ attachments, onAttachMenuSelect: () => {} });
      await expect.element(screen.getByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Add media" }).click();
      await expect.element(screen.getByRole("menuitem", { name: "Add media" })).not.toBeInTheDocument();
      await expect.element(screen.getByRole("menuitem", { name: "Create image" })).toBeVisible();
    });
  });

  describe("Composer model and option menus", () => {
    it("multi-select models adds and removes picks", async () => {
      const onModelIdsChange = vi.fn();
      const screen = harness({ useCase: IMAGE, models: MODELS, multiSelectModels: true, modelIds: ["fal/fast"], onModelIdsChange });
      await screen.getByText("Fast Image").click();
      await screen.getByRole("button", { name: "Pro Image" }).click();
      expect(onModelIdsChange).toHaveBeenLastCalledWith(["fal/fast", "fal/pro"]);
      // The option, not the trigger (which also reads "Fast Image").
      await screen.getByRole("button", { name: "Fast Image", pressed: true }).click();
      expect(onModelIdsChange).toHaveBeenLastCalledWith([]);
    });

    it("names the trigger by how many models are picked", async () => {
      const screen = harness({ useCase: IMAGE, models: MODELS, multiSelectModels: true, modelIds: ["fal/fast", "fal/pro"] });
      await expect.element(screen.getByText("2 models")).toBeVisible();
    });

    it("turning auto-select on clears multi-select picks", async () => {
      const onModelIdsChange = vi.fn();
      const screen = harness({ useCase: IMAGE, models: MODELS, multiSelectModels: true, modelIds: ["fal/fast"], autoSelectModel: false, onModelIdsChange });
      await screen.rerender({ autoSelectModel: true });
      await expect.poll(() => onModelIdsChange.mock.calls).toEqual([[[]]]);
    });

    it("multi-use-case select: a section per use case, and each chip removes its use case", async () => {
      const onUseCasesChange = vi.fn();
      const onSubmit = vi.fn();
      const useCases: ComposerUseCase[] = [IMAGE, VIDEO];
      const videoModels: ModelOption[] = [{ id: "fal/video", label: "Video Model", provider: "fal", speed: "slow" }];
      const screen = harness({
        value: "a mug",
        multiSelectUseCases: true,
        useCases,
        onUseCasesChange,
        modelsByKind: { image: MODELS, video: videoModels },
        modelIds: ["fal/pro", "fal/video"],
        onSubmit,
      });
      await screen.getByText("Video").hover();
      await screen.getByRole("button", { name: "Remove Video" }).click();
      expect(onUseCasesChange).toHaveBeenCalledWith([IMAGE]);

      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0].selections).toEqual([
        { useCase: IMAGE, modelIds: ["fal/pro"], models: MODELS },
        { useCase: VIDEO, modelIds: ["fal/video"], models: videoModels },
      ]);
    });

    it("offers the picked model's aspect ratios, and shows the one picked", async () => {
      const onAspectRatioChange = vi.fn();
      const screen = harness({ useCase: IMAGE, models: [SQUARE_WIDE, WIDE_TALL], modelId: "fal/sw", onAspectRatioChange });
      await screen.getByText("Aspect ratio").click();
      await expect.element(screen.getByRole("button", { name: "1:1" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "9:16" })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "16:9" }).click();
      expect(onAspectRatioChange).toHaveBeenCalledWith("16:9");
      await screen.rerender({ aspectRatio: "16:9" });
      await expect.element(screen.getByRole("button", { name: "16:9", expanded: false })).toBeVisible();
    });

    it("with no model picked, offers only ratios every model takes, with the builder's labels", async () => {
      const screen = harness({
        useCase: IMAGE,
        models: [SQUARE_WIDE, WIDE_TALL],
        aspectRatios: [
          { value: "1:1", label: "Square" },
          { value: "16:9", label: "Wide" },
        ],
      });
      await screen.getByText("Aspect ratio").click();
      await expect.element(screen.getByRole("button", { name: "Wide" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Square" })).not.toBeInTheDocument();
    });

    it("hides the menu for a model that sets its own shape", async () => {
      const screen = harness({ useCase: IMAGE, models: [OWN_SHAPE], modelId: "fal/own", aspectRatios: [{ value: "1:1", label: "1:1" }] });
      await expect.element(screen.getByText("Own shape")).toBeInTheDocument();
      await expect.element(screen.getByText("Aspect ratio")).not.toBeInTheDocument();
    });

    it("offers Chai's suggested models when the app passes none, with the first picked", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, onSubmit });
      await expect.element(screen.getByText("Nano Banana Pro")).toBeInTheDocument();
      // The first model's aspect ratios fill the menu.
      await expect.element(screen.getByText("Aspect ratio")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: "fal-ai/nano-banana-pro" });
      expect(onSubmit.mock.calls[0]![0].selections[0].models.length).toBeGreaterThan(1);
    });

    it("suggests edit models in edit mode, and none for a text request", async () => {
      const edit = harness({ useCase: EDIT_IMAGE_USE_CASE });
      await expect.element(edit.getByText("Flux 3 Image")).toBeInTheDocument();
      edit.unmount();
      const text = harness();
      await expect.element(text.getByText("Select models")).not.toBeInTheDocument();
    });

    it("hides the Model and Aspect ratio menus with nowhere for a pick to go, and still runs the first suggested model", async () => {
      const onSubmit = vi.fn();
      const screen = render({ value: "a mug", onChange: () => {}, useCase: IMAGE, onSubmit });
      await expect.element(screen.getByText("Nano Banana Pro")).not.toBeInTheDocument();
      await expect.element(screen.getByText("Aspect ratio")).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: "fal-ai/nano-banana-pro" });
    });

    it("never submits a model that isn't in the current list", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, models: MODELS, modelId: "gone/model", onSubmit });
      await expect.element(screen.getByText("Select models")).toBeInTheDocument();
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: null });
      expect(onSubmit.mock.calls[0]![0].selections[0].modelIds).toEqual([]);
    });

    it("never submits a ratio the picked model doesn't take", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ value: "a mug", useCase: IMAGE, models: [SQUARE_WIDE], modelId: "fal/sw", aspectRatio: "9:16", onSubmit });
      await screen.getByRole("button", { name: "Submit" }).click();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ aspectRatio: null });
    });
  });

  describe("Composer accessibility", () => {
    /** The Composer's busiest everyday state: a use case, a model menu with the auto-select switch, aspect ratios, Enhance. */
    const full = () =>
      controlled<ComposerProps>(
        render,
        {
          value: "a mug",
          onChange: () => {},
          onSubmit: () => {},
          onEnhance: () => {},
          useCase: IMAGE,
          onClearUseCase: () => {},
          models: MODELS,
          modelId: "fal/fast",
          onModelChange: () => {},
          showAutoSelectToggle: true,
          onAutoSelectModelChange: () => {},
          aspectRatios: [
            { value: "1:1", label: "1:1" },
            { value: "16:9", label: "16:9" },
          ],
          aspectRatio: "1:1",
          onAspectRatioChange: () => {},
        },
        { onChange: "value", onModelChange: "modelId" }
      );

    it("passes axe, with the model menu closed and open, and names the auto-select switch", async () => {
      const screen = full();
      expect(await wcagViolations()).toEqual([]);
      await screen.getByText("Fast Image").click();
      expect(await wcagViolations()).toEqual([]);
      await expect.element(screen.getByRole("switch", { name: "Auto-select model" })).toBeInTheDocument();
    });

    it("passes axe editing an image, with region chips", async () => {
      render({
        value: "",
        onChange: () => {},
        onSubmit: () => {},
        useCase: EDIT_IMAGE_USE_CASE,
        onClearUseCase: () => {},
        attachments: [{ id: "a", src: svg, kind: "image" }],
        regions: [{ id: "r1", number: 1, box: { x: 0, y: 0, width: 0.5, height: 0.5 }, prompt: "x" }],
        onRegionsChange: () => {},
      });
      expect(await wcagViolations()).toEqual([]);
    });

    // axe accepts a placeholder as a field's name, so this is checked directly.
    it("names the prompt field, defaulting to the placeholder", async () => {
      const screen = render({ value: "", onChange: () => {}, onSubmit: () => {}, placeholder: "Describe media to create" });
      await expect.element(screen.getByRole("textbox", { name: "Describe media to create" })).toBeInTheDocument();
      await screen.rerender({ value: "", onChange: () => {}, onSubmit: () => {}, promptLabel: "Prompt" });
      await expect.element(screen.getByRole("textbox", { name: "Prompt" })).toBeInTheDocument();
    });
  });
}
