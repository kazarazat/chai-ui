/** WCAG 2.2 AA checks with axe, on each component's main states. */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import { MEDIA_ANALYSIS_PROMPT_LENGTHS, type MediaAnalysisPromptLength, type ModelOption, type Result } from "@chai-ui/core";
import { Composer, EDIT_IMAGE_USE_CASE } from "../Composer.js";
import { EditCard } from "../EditCard.js";
import { MediaAnalyzer, type MediaAnalyzerAttachment } from "../MediaAnalyzer.js";
import { ResultCard } from "../ResultCard.js";
import { wcagViolations } from "./axe.js";

const model = (id: string, label = id): ModelOption => ({ id, label, provider: "p", speed: "fast" });
const MODELS = [model("fal/fast", "Fast Image"), model("fal/pro", "Pro Image")];
const IMAGE = { kind: "image" as const, label: "Image" };
const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#09f"/></svg>')}`;
const result = (id: string, overrides: Partial<Result> = {}): Result => ({
  id, runId: "run", modelId: "fal/fast", status: "done", output: { src: svg, kind: "image" }, ...overrides,
});

function ComposerHarness() {
  const [value, setValue] = useState("a mug");
  const [modelId, setModelId] = useState<string | null>("fal/fast");
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      onEnhance={() => {}}
      useCase={IMAGE}
      onClearUseCase={() => {}}
      models={MODELS}
      modelId={modelId}
      onModelChange={setModelId}
      showAutoSelectToggle
      onAutoSelectModelChange={() => {}}
      aspectRatios={[{ value: "1:1", label: "1:1" }, { value: "16:9", label: "16:9" }]}
      aspectRatio="1:1"
      onAspectRatioChange={() => {}}
    />
  );
}

function AnalyzerHarness() {
  const [attachments, setAttachments] = useState<MediaAnalyzerAttachment[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [length, setLength] = useState<MediaAnalysisPromptLength | null>(null);
  return (
    <MediaAnalyzer
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      models={[]}
      modelsByKind={{ image: MODELS, video: [model("v")], audio: [model("a")] }}
      modelId={modelId}
      onModelChange={setModelId}
      autoSelectModel={auto}
      onAutoSelectModelChange={setAuto}
      promptLength={length}
      onPromptLengthChange={setLength}
      promptLengthOptions={MEDIA_ANALYSIS_PROMPT_LENGTHS}
      onSubmit={() => {}}
    />
  );
}

describe("WCAG 2.2 AA (axe)", () => {
  it("Composer", async () => {
    render(<ComposerHarness />);
    expect(await wcagViolations()).toEqual([]);
  });

  it("Composer with the model menu open", async () => {
    const screen = render(<ComposerHarness />);
    await screen.getByText("Fast Image").click();
    expect(await wcagViolations()).toEqual([]);
  });

  it("MediaAnalyzer, empty and with an image", async () => {
    render(<AnalyzerHarness />);
    expect(await wcagViolations()).toEqual([]);
    const input = document.querySelector<HTMLInputElement>('.chai-media-analyzer input[type="file"]')!;
    await userEvent.upload(input, new File(["x"], "photo.png", { type: "image/png" }));
    expect(await wcagViolations()).toEqual([]);
  });

  it("ResultCard: paginated image, flipped, text, error and stopped", async () => {
    const screen = render(<ResultCard results={[result("r1"), result("r2"), result("r3")]} prompt="a mug" onAction={() => {}} />);
    expect(await wcagViolations()).toEqual([]);
    await screen.getByRole("button", { name: "Show details" }).click();
    expect(await wcagViolations()).toEqual([]);
    screen.unmount();

    render(
      <ResultCard
        results={[
          result("t", { output: { src: "A long answer.", kind: "text" } }),
          result("e", { status: "error", output: undefined, error: { message: "Timed out." } }),
          result("c", { status: "cancelled", output: undefined }),
        ]}
        prompt="x"
        onAction={() => {}}
      />
    );
    expect(await wcagViolations()).toEqual([]);
  });

  it("EditCard: regions, the open instruction field, zoomed, and an edit in progress", async () => {
    const regions = [
      { id: "r1", number: 1, box: { x: 0.1, y: 0.4, width: 0.3, height: 0.2 }, prompt: "make it green" },
      { id: "r2", number: 2, box: { x: 0.5, y: 0.5, width: 0.3, height: 0.2 }, prompt: "" },
    ];
    const versions = [
      { id: "original", src: svg, status: "done" as const, regions: [] },
      { id: "e1", from: svg, status: "running" as const, regions },
    ];
    const screen = render(
      <EditCard versions={versions} activeVersion={0} onActiveVersionChange={() => {}} regions={regions} onRegionsChange={() => {}} />
    );
    expect(await wcagViolations()).toEqual([]);
    await screen.getByRole("button", { name: /^Region 1/ }).click();
    expect(await wcagViolations()).toEqual([]);
    await screen.getByRole("button", { name: "Zoom in" }).click();
    expect(await wcagViolations()).toEqual([]);
    screen.rerender(
      <EditCard versions={versions} activeVersion={1} onActiveVersionChange={() => {}} regions={[]} onRegionsChange={() => {}} />
    );
    expect(await wcagViolations()).toEqual([]);
  });

  it("Composer editing an image, with region chips", async () => {
    render(
      <Composer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        useCase={EDIT_IMAGE_USE_CASE}
        onClearUseCase={() => {}}
        attachments={[{ id: "a", src: svg, kind: "image" }]}
        regions={[{ id: "r1", number: 1, box: { x: 0, y: 0, width: 0.5, height: 0.5 }, prompt: "x" }]}
        onRegionsChange={() => {}}
      />
    );
    expect(await wcagViolations()).toEqual([]);
  });

  // axe accepts a placeholder as a field's name and an empty alt as
  // valid, so these two are checked directly.
  it("names the Composer prompt field, defaulting to the placeholder", async () => {
    const screen = render(<Composer value="" onChange={() => {}} onSubmit={() => {}} placeholder="Describe media to create" />);
    await expect.element(screen.getByRole("textbox", { name: "Describe media to create" })).toBeInTheDocument();
    screen.rerender(<Composer value="" onChange={() => {}} onSubmit={() => {}} promptLabel="Prompt" />);
    await expect.element(screen.getByRole("textbox", { name: "Prompt" })).toBeInTheDocument();
  });

  it("gives generated images alt text, defaulting to the prompt", async () => {
    const screen = render(<ResultCard results={[result("r1")]} prompt="a red mug on oak" onAction={() => {}} />);
    await expect.element(screen.getByRole("img", { name: "a red mug on oak" })).toBeInTheDocument();
    screen.rerender(<ResultCard results={[result("r1")]} prompt="x" altText={() => "Custom alt"} onAction={() => {}} />);
    await expect.element(screen.getByRole("img", { name: "Custom alt" })).toBeInTheDocument();
  });

  it("names the auto-select switch", async () => {
    const screen = render(<ComposerHarness />);
    await screen.getByText("Fast Image").click();
    await expect.element(screen.getByRole("switch", { name: "Auto-select model" })).toBeInTheDocument();
  });

  describe("keyboard and focus", () => {
    const video = (id: string) => result(id, { output: { src: "data:video/mp4;base64,AAAA", kind: "video" } });

    it("video: play/pause and seek are keyboard controls, and axe passes", async () => {
      const screen = render(<ResultCard results={[video("v")]} prompt="a clip" onAction={() => {}} />);
      await expect.element(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
      const seek = screen.getByRole("slider", { name: "Seek" });
      await expect.element(seek).toHaveAttribute("tabindex", "0");
      await expect.element(seek).toHaveAttribute("aria-valuenow", "0");
      expect(await wcagViolations()).toEqual([]);
    });

    it("flipping moves focus to the side now showing", async () => {
      const screen = render(<ResultCard results={[result("r1")]} prompt="a mug" onAction={() => {}} />);
      await screen.getByRole("button", { name: "Show details" }).click();
      await expect.element(screen.getByRole("button", { name: "Close details" })).toHaveFocus();
      await screen.getByRole("button", { name: "Close details" }).click();
      await expect.element(screen.getByRole("button", { name: "Show details" })).toHaveFocus();
    });

    it("the expanded view is a dialog: focus moves in, stays in, Escape closes and returns focus", async () => {
      const screen = render(<ResultCard results={[result("r1")]} prompt="a mug" onAction={() => {}} />);
      const expand = screen.getByRole("button", { name: "Expand" });
      await expand.click();
      const dialog = screen.getByRole("dialog", { name: "Expanded image" });
      await expect.element(dialog).toBeVisible();
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();
      expect(await wcagViolations()).toEqual([]);

      await userEvent.keyboard("{Tab}");
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();

      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(expand).toHaveFocus();
    });
  });
});
