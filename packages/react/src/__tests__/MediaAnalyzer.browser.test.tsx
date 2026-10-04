import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import { MEDIA_ANALYSIS_PROMPT_LENGTHS, type MediaAnalysisPromptLength, type ModelOption } from "@chai-ui/core";
import { MediaAnalyzer, type MediaAnalyzerAttachment, type MediaAnalyzerProps } from "../MediaAnalyzer.js";

const model = (id: string): ModelOption => ({ id, label: id, provider: "p", speed: "fast" });
const MODELS_BY_KIND = { image: [model("vision/a"), model("vision/b")], video: [model("video/a")], audio: [model("audio/a")] };

function Harness(props: Partial<MediaAnalyzerProps>) {
  const [attachments, setAttachments] = useState<MediaAnalyzerAttachment[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [autoSelectModel, setAutoSelectModel] = useState(false);
  const [promptLength, setPromptLength] = useState<MediaAnalysisPromptLength | null>(null);
  return (
    <MediaAnalyzer
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      models={[]}
      modelsByKind={MODELS_BY_KIND}
      modelId={modelId}
      onModelChange={setModelId}
      autoSelectModel={autoSelectModel}
      onAutoSelectModelChange={setAutoSelectModel}
      promptLength={promptLength}
      onPromptLengthChange={setPromptLength}
      promptLengthOptions={MEDIA_ANALYSIS_PROMPT_LENGTHS}
      onSubmit={() => {}}
      {...props}
    />
  );
}

const file = (name: string, type: string) => new File(["x"], name, { type });
const fileInput = () => document.querySelector<HTMLInputElement>('.chai-media-analyzer input[type="file"]')!;

describe("MediaAnalyzer", () => {
  it("detects the media kind and submits it with that kind's models", async () => {
    const onSubmit = vi.fn();
    const screen = render(<Harness onSubmit={onSubmit} />);
    await userEvent.upload(fileInput(), file("clip.mp3", "audio/mpeg"));
    await screen.getByRole("button", { name: "Analyze media" }).click();

    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.attachments[0].kind).toBe("audio");
    expect(payload.models).toEqual(MODELS_BY_KIND.audio);
  });

  it("stops taking images at 5", async () => {
    const screen = render(<Harness />);
    await userEvent.upload(fileInput(), [1, 2, 3, 4, 5].map((i) => file(`p${i}.png`, "image/png")));
    await expect.element(screen.getByText("Maximum images added")).toBeVisible();
  });

  it("reports an unsupported file instead of attaching it", async () => {
    const onUnsupportedFile = vi.fn();
    render(<Harness onUnsupportedFile={onUnsupportedFile} />);
    await userEvent.upload(fileInput(), file("notes.txt", "text/plain"));
    expect(onUnsupportedFile).toHaveBeenCalledWith("notes.txt");
  });

  it("turning auto-select on clears the pick and says Auto-select model", async () => {
    const onModelChange = vi.fn();
    const base = { modelsByKind: MODELS_BY_KIND, onModelChange };
    const screen = render(<Harness {...base} modelId="vision/a" autoSelectModel={false} />);
    screen.rerender(<Harness {...base} modelId="vision/a" autoSelectModel />);
    expect(onModelChange).toHaveBeenCalledWith(null);
    screen.rerender(<Harness {...base} modelId={null} autoSelectModel />);
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
    const screen = render(<Harness />);
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
    render(<Harness disabled onAttachmentsChange={onAttachmentsChange} />);
    dropzone().dispatchEvent(dragEvent("drop", [file("photo.png", "image/png")]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it("a second video replaces the first, and an attachment can be removed", async () => {
    const screen = render(<Harness />);
    await userEvent.upload(fileInput(), file("one.mp4", "video/mp4"));
    await expect.element(screen.getByRole("button", { name: "Remove one.mp4" })).toBeInTheDocument();
    await userEvent.upload(fileInput(), file("two.mp4", "video/mp4"));
    await expect.element(screen.getByRole("button", { name: "Remove two.mp4" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Remove one.mp4" })).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Remove two.mp4" }).click();
    await expect.element(screen.getByRole("button", { name: "Remove two.mp4" })).not.toBeInTheDocument();
  });

  it("shows a failed analysis's message", async () => {
    const screen = render(<Harness submitError="The analysis model timed out." />);
    await expect.element(screen.getByRole("alert")).toHaveTextContent("The analysis model timed out.");
  });
});

