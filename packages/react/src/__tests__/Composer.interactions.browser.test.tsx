import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { ModelOption } from "@chai-ui/core";
import { Composer, type ComposerAttachment, type ComposerProps, type ComposerUseCase } from "../Composer.js";

const IMAGE = { kind: "image" as const, label: "Image" };
const VIDEO = { kind: "video" as const, label: "Video" };
const MODELS: ModelOption[] = [
  { id: "fal/fast", label: "Fast Image", provider: "fal", speed: "fast" },
  { id: "fal/pro", label: "Pro Image", provider: "fal", speed: "standard" },
];

function Harness(props: Partial<ComposerProps> & { initialValue?: string }) {
  const { initialValue = "", ...rest } = props;
  const [value, setValue] = useState(initialValue);
  return <Composer value={value} onChange={setValue} onSubmit={() => {}} {...rest} />;
}

const fileInput = () => document.querySelector<HTMLInputElement>('.chai-composer input[type="file"]')!;
const file = (name: string, type: string) => new File(["x"], name, { type });

describe("Composer attach menu", () => {
  it("opens, lists the actions, reports a pick and closes", async () => {
    const onAttachMenuSelect = vi.fn();
    const screen = render(<Harness onAttachMenuSelect={onAttachMenuSelect} />);
    await screen.getByRole("button", { name: "Add media" }).click();
    for (const item of ["Add media", "Create image", "Create video", "Edit image"]) {
      await expect.element(screen.getByRole("menuitem", { name: item })).toBeVisible();
    }
    await screen.getByRole("menuitem", { name: "Create video" }).click();
    expect(onAttachMenuSelect).toHaveBeenCalledWith("create-video");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and on a click outside", async () => {
    const screen = render(
      <div>
        <p>Outside</p>
        <Harness />
      </div>
    );
    await screen.getByRole("button", { name: "Add media" }).click();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Add media" }).click();
    await expect.element(screen.getByRole("button", { name: "Close attach menu" })).toBeVisible();
    await screen.getByText("Outside").click();
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Composer attachments", () => {
  function Attaching(props: Partial<ComposerProps>) {
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
    return <Harness attachments={attachments} onAttachmentsChange={setAttachments} {...props} />;
  }

  it("reads picked files by kind and reports unsupported ones", async () => {
    const onUnsupportedFile = vi.fn();
    const screen = render(<Attaching onUnsupportedFile={onUnsupportedFile} />);
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
    const screen = render(<Harness attachments={attachments} onAttachmentsChange={onAttachmentsChange} />);
    await screen.getByRole("button", { name: "Remove attachment" }).first().click();
    expect(onAttachmentsChange).toHaveBeenCalledWith([attachments[1]]);
  });

  it("does nothing with files when there's nowhere to put them", async () => {
    render(<Harness />);
    await userEvent.upload(fileInput(), file("photo.png", "image/png"));
    expect(document.querySelector(".chai-composer__thumb")).toBeNull();
  });
});

describe("Composer prompt optimization", () => {
  it("reveals a short rewrite, then undo restores the original", async () => {
    function Enhancing() {
      const [value, setValue] = useState("a mug");
      const [enhancing, setEnhancing] = useState(false);
      return (
        <Composer
          value={value}
          onChange={setValue}
          onSubmit={() => {}}
          enhancing={enhancing}
          onEnhance={() => {
            setEnhancing(true);
            setTimeout(() => {
              setValue("a red ceramic mug on oak");
              setEnhancing(false);
            }, 20);
          }}
        />
      );
    }
    const screen = render(<Enhancing />);
    await screen.getByRole("button", { name: "Optimize prompt" }).click();
    // While the rewrite is revealed, a decorative copy paints the text in.
    await expect.poll(() => document.querySelector(".chai-composer__reveal")).not.toBeNull();
    await expect.poll(() => document.querySelector(".chai-composer__reveal")).toBeNull();
    await expect.element(screen.getByRole("textbox")).toHaveValue("a red ceramic mug on oak");

    await screen.getByRole("button", { name: "Revert to original prompt" }).click();
    await expect.element(screen.getByRole("textbox")).toHaveValue("a mug");
  });
});

describe("Composer model and option menus", () => {
  it("multi-select models adds and removes picks", async () => {
    const onModelIdsChange = vi.fn();
    const screen = render(
      <Harness useCase={IMAGE} models={MODELS} multiSelectModels modelIds={["fal/fast"]} onModelIdsChange={onModelIdsChange} />
    );
    await screen.getByText("Fast Image").click();
    await screen.getByRole("button", { name: "Pro Image" }).click();
    expect(onModelIdsChange).toHaveBeenLastCalledWith(["fal/fast", "fal/pro"]);
    // The option, not the trigger (which also reads "Fast Image").
    await screen.getByRole("button", { name: "Fast Image", pressed: true }).click();
    expect(onModelIdsChange).toHaveBeenLastCalledWith([]);
  });

  it("names the trigger by how many models are picked", async () => {
    const screen = render(
      <Harness useCase={IMAGE} models={MODELS} multiSelectModels modelIds={["fal/fast", "fal/pro"]} onModelIdsChange={() => {}} />
    );
    await expect.element(screen.getByText("2 models")).toBeVisible();
  });

  it("turning auto-select on clears multi-select picks", async () => {
    const onModelIdsChange = vi.fn();
    const props = { useCase: IMAGE, models: MODELS, multiSelectModels: true, modelIds: ["fal/fast"], onModelIdsChange };
    const screen = render(<Harness {...props} autoSelectModel={false} />);
    screen.rerender(<Harness {...props} autoSelectModel />);
    expect(onModelIdsChange).toHaveBeenCalledWith([]);
  });

  it("multi-use-case select: a section per use case, and each chip removes its use case", async () => {
    const onUseCasesChange = vi.fn();
    const onSubmit = vi.fn();
    const useCases: ComposerUseCase[] = [IMAGE, VIDEO];
    const videoModels: ModelOption[] = [{ id: "fal/video", label: "Video Model", provider: "fal", speed: "slow" }];
    const screen = render(
      <Harness
        initialValue="a mug"
        multiSelectUseCases
        useCases={useCases}
        onUseCasesChange={onUseCasesChange}
        modelsByKind={{ image: MODELS, video: videoModels }}
        modelIds={["fal/pro", "fal/video"]}
        onModelIdsChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    await screen.getByText("Video").hover();
    await screen.getByRole("button", { name: "Remove Video" }).click();
    expect(onUseCasesChange).toHaveBeenCalledWith([IMAGE]);

    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0].selections).toEqual([
      { useCase: IMAGE, modelIds: ["fal/pro"], models: MODELS },
      { useCase: VIDEO, modelIds: ["fal/video"], models: videoModels },
    ]);
  });

  const SQUARE_WIDE: ModelOption = { id: "fal/sw", label: "Square and wide", provider: "fal", speed: "fast", aspectRatios: ["1:1", "16:9"] };
  const WIDE_TALL: ModelOption = { id: "fal/wt", label: "Wide and tall", provider: "fal", speed: "fast", aspectRatios: ["16:9", "9:16"] };
  const OWN_SHAPE: ModelOption = { id: "fal/own", label: "Own shape", provider: "fal", speed: "fast" };

  it("offers the picked model's aspect ratios", async () => {
    const onAspectRatioChange = vi.fn();
    const screen = render(
      <Harness useCase={IMAGE} models={[SQUARE_WIDE, WIDE_TALL]} modelId="fal/sw" onAspectRatioChange={onAspectRatioChange} />
    );
    await screen.getByText("Aspect ratio").click();
    await expect.element(screen.getByRole("button", { name: "1:1" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "9:16" })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "16:9" }).click();
    expect(onAspectRatioChange).toHaveBeenCalledWith("16:9");
  });

  it("with no model picked, offers only ratios every model takes, with the builder's labels", async () => {
    const screen = render(
      <Harness
        useCase={IMAGE}
        models={[SQUARE_WIDE, WIDE_TALL]}
        aspectRatios={[
          { value: "1:1", label: "Square" },
          { value: "16:9", label: "Wide" },
        ]}
      />
    );
    await screen.getByText("Aspect ratio").click();
    await expect.element(screen.getByRole("button", { name: "Wide" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Square" })).not.toBeInTheDocument();
  });

  it("hides the menu for a model that sets its own shape", async () => {
    const screen = render(<Harness useCase={IMAGE} models={[OWN_SHAPE]} modelId="fal/own" aspectRatios={[{ value: "1:1", label: "1:1" }]} />);
    await expect.element(screen.getByText("Own shape")).toBeInTheDocument();
    await expect.element(screen.getByText("Aspect ratio")).not.toBeInTheDocument();
  });

  it("never submits a ratio the picked model doesn't take", async () => {
    const onSubmit = vi.fn();
    const screen = render(
      <Harness initialValue="a mug" useCase={IMAGE} models={[SQUARE_WIDE]} modelId="fal/sw" aspectRatio="9:16" onSubmit={onSubmit} />
    );
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ aspectRatio: null });
  });
});

describe("Composer after a failed submit", () => {
  it("shows the message and retries with the same payload", async () => {
    const onSubmit = vi.fn();
    const screen = render(<Harness initialValue="a mug" submitError="The model timed out." onSubmit={onSubmit} />);
    await expect.element(screen.getByRole("alert")).toHaveTextContent("The model timed out.");
    await screen.getByRole("button", { name: "Retry" }).click();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ value: "a mug" }));
  });
});
