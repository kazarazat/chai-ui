import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  MEDIA_ANALYSIS_PROMPT_LENGTHS,
  type MediaAnalysisPromptLength,
  type MediaAnalyzerAttachment,
  type MediaAnalyzerSubmitPayload,
  type MediaKind,
  type ModelOption,
} from "@chai-ui/core";
import { wcagViolations } from "../axe.js";
import { controlled, type Render } from "./render.js";

export interface MediaAnalyzerProps {
  attachments: MediaAnalyzerAttachment[];
  onAttachmentsChange: (next: MediaAnalyzerAttachment[]) => void;
  onUnsupportedFile?: (fileName: string) => void;
  models?: ModelOption[];
  modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
  modelId: string | null;
  onModelChange: (id: string | null) => void;
  autoSelectModel: boolean;
  onAutoSelectModelChange: (next: boolean) => void;
  promptLength: MediaAnalysisPromptLength | null;
  onPromptLengthChange: (value: MediaAnalysisPromptLength) => void;
  promptLengthOptions: { value: MediaAnalysisPromptLength; label: string }[];
  disabled?: boolean;
  submitting?: boolean;
  submitError?: string | null;
  onSubmit: (payload: MediaAnalyzerSubmitPayload) => void;
  onAbort?: () => void;
}

const model = (id: string): ModelOption => ({ id, label: id, provider: "p", speed: "fast" });
const MODELS_BY_KIND = { image: [model("vision/a"), model("vision/b")], video: [model("video/a")], audio: [model("audio/a")] };
const file = (name: string, type: string) => new File(["x"], name, { type });
const fileInput = () => document.querySelector<HTMLInputElement>('.chai-media-analyzer input[type="file"]')!;

export function mediaAnalyzerContract(render: Render<MediaAnalyzerProps>) {
  /** A MediaAnalyzer whose parent holds its state, as an app would. */
  const harness = (props: Partial<MediaAnalyzerProps> = {}) =>
    controlled(
      render,
      {
        attachments: [],
        onAttachmentsChange: () => {},
        models: [],
        modelsByKind: MODELS_BY_KIND,
        modelId: null,
        onModelChange: () => {},
        autoSelectModel: false,
        onAutoSelectModelChange: () => {},
        promptLength: null,
        onPromptLengthChange: () => {},
        promptLengthOptions: MEDIA_ANALYSIS_PROMPT_LENGTHS,
        onSubmit: () => {},
        ...props,
      },
      {
        onAttachmentsChange: "attachments",
        onModelChange: "modelId",
        onAutoSelectModelChange: "autoSelectModel",
        onPromptLengthChange: "promptLength",
      }
    );

  describe("MediaAnalyzer", () => {
    it("detects the media kind and submits it with that kind's models", async () => {
      const onSubmit = vi.fn();
      const screen = harness({ onSubmit });
      await userEvent.upload(fileInput(), file("clip.mp3", "audio/mpeg"));
      await screen.getByRole("button", { name: "Analyze media" }).click();

      const payload = onSubmit.mock.calls[0]![0];
      expect(payload.attachments[0].kind).toBe("audio");
      expect(payload.models).toEqual(MODELS_BY_KIND.audio);
    });

    it("stops taking images at 5", async () => {
      const screen = harness();
      await userEvent.upload(fileInput(), [1, 2, 3, 4, 5].map((i) => file(`p${i}.png`, "image/png")));
      await expect.element(screen.getByText("Maximum images added")).toBeVisible();
    });

    it("reports an unsupported file instead of attaching it", async () => {
      const onUnsupportedFile = vi.fn();
      harness({ onUnsupportedFile });
      await userEvent.upload(fileInput(), file("notes.txt", "text/plain"));
      expect(onUnsupportedFile).toHaveBeenCalledWith("notes.txt");
    });

    it("turning auto-select on clears the pick and says Auto-select model", async () => {
      const onModelChange = vi.fn();
      const screen = harness({ modelId: "vision/a", onModelChange });
      await screen.rerender({ autoSelectModel: true });
      await expect.poll(() => onModelChange.mock.calls).toEqual([[null]]);
      await expect.element(screen.getByText("Auto-select model")).toBeVisible();
    });
  });

  describe("MediaAnalyzer drop zone", () => {
    const dropzone = () => document.querySelector(".chai-media-analyzer__dropzone")!;
    function dragEvent(type: string, files: File[] = []) {
      const data = new DataTransfer();
      for (const f of files) data.items.add(f);
      return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data });
    }

    it("highlights while a file is dragged over, and attaches what's dropped", async () => {
      const screen = harness();
      dropzone().dispatchEvent(dragEvent("dragenter"));
      await expect.poll(() => dropzone().classList.contains("chai-media-analyzer__dropzone--drag-active")).toBe(true);
      dropzone().dispatchEvent(dragEvent("dragover"));
      dropzone().dispatchEvent(dragEvent("dragleave"));
      await expect.poll(() => dropzone().classList.contains("chai-media-analyzer__dropzone--drag-active")).toBe(false);

      dropzone().dispatchEvent(dragEvent("drop", [file("photo.png", "image/png")]));
      await expect.element(screen.getByRole("button", { name: "Remove photo.png" })).toBeInTheDocument();
    });

    it("ignores a drop while disabled", async () => {
      const onAttachmentsChange = vi.fn();
      harness({ disabled: true, onAttachmentsChange });
      dropzone().dispatchEvent(dragEvent("drop", [file("photo.png", "image/png")]));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onAttachmentsChange).not.toHaveBeenCalled();
    });

    it("offers Chai's suggested analysis models when the app passes none", async () => {
      const screen = harness({ modelsByKind: undefined });
      await userEvent.upload(fileInput(), file("clip.wav", "audio/wav"));
      await screen.getByText("Select model").click();
      await expect.element(screen.getByRole("button", { name: "GPT Audio" })).toBeInTheDocument();
    });

    it("says what an attach of another kind replaced", async () => {
      const screen = harness();
      await userEvent.upload(fileInput(), [file("a.png", "image/png"), file("b.png", "image/png")]);
      await expect.element(screen.getByRole("button", { name: "Remove b.png" })).toBeInTheDocument();
      await userEvent.upload(fileInput(), file("clip.wav", "audio/wav"));
      await expect.element(screen.getByRole("status")).toHaveTextContent("Replaced 2 images with clip.wav.");
      // Gone once the attachments change some other way.
      await screen.getByRole("button", { name: "Remove clip.wav" }).click();
      await expect.element(screen.getByRole("status")).not.toBeInTheDocument();
    });

    it("turns submit into stop while analyzing, with onAbort", async () => {
      const onAbort = vi.fn();
      const attachments = [{ id: "a", src: "data:image/png;base64,x", kind: "image" as const, name: "a.png" }];
      const screen = harness({ attachments, submitting: true, onAbort });
      await screen.getByRole("button", { name: "Stop" }).click();
      expect(onAbort).toHaveBeenCalled();
    });

    it("a second video replaces the first, and an attachment can be removed", async () => {
      const screen = harness();
      await userEvent.upload(fileInput(), file("one.mp4", "video/mp4"));
      await expect.element(screen.getByRole("button", { name: "Remove one.mp4" })).toBeInTheDocument();
      await userEvent.upload(fileInput(), file("two.mp4", "video/mp4"));
      await expect.element(screen.getByRole("button", { name: "Remove two.mp4" })).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Remove one.mp4" })).not.toBeInTheDocument();

      await screen.getByRole("button", { name: "Remove two.mp4" }).click();
      await expect.element(screen.getByRole("button", { name: "Remove two.mp4" })).not.toBeInTheDocument();
    });

    it("shows a failed analysis's message", async () => {
      const screen = harness({ submitError: "The analysis model timed out." });
      await expect.element(screen.getByRole("alert")).toHaveTextContent("The analysis model timed out.");
    });
  });

    describe("MediaAnalyzer accessibility", () => {
      it("passes axe empty and with an image", async () => {
        harness();
        expect(await wcagViolations()).toEqual([]);
        await userEvent.upload(fileInput(), file("photo.png", "image/png"));
        await expect.element(document.querySelector(".chai-media-analyzer__thumb")!).toBeInTheDocument();
        expect(await wcagViolations()).toEqual([]);
      });
    });
}
