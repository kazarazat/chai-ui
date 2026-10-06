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
  // Pickers only show with somewhere for a pick to go.
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      onModelChange={() => {}}
      onModelIdsChange={() => {}}
      onAspectRatioChange={() => {}}
      {...rest}
    />
  );
}

const fileInput = () => document.querySelector<HTMLInputElement>('.chai-composer input[type="file"]')!;
const file = (name: string, type: string) => new File(["x"], name, { type });

describe("Composer attach menu", () => {
  it("opens, lists the actions, reports a pick and closes", async () => {
    const onAttachMenuSelect = vi.fn();
    const screen = render(<Harness onAttachMenuSelect={onAttachMenuSelect} onAttachmentsChange={() => {}} />);
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
        <Harness onAttachMenuSelect={() => {}} />
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

  it("shows no add or remove controls when there's nowhere to put files", async () => {
    const attachments: ComposerAttachment[] = [{ id: "a", src: "data:image/png;base64,x", kind: "image", name: "a.png" }];
    const screen = render(<Harness attachments={attachments} onAttachMenuSelect={() => {}} />);
    await expect.element(screen.getByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Add media" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Add media" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("menuitem", { name: "Create image" })).toBeVisible();
  });

  it("hides the + menu when nothing in it is wired, and shows only the items asked for", async () => {
    const bare = render(<Harness />);
    await expect.element(bare.getByRole("button", { name: "Add media" })).not.toBeInTheDocument();
    bare.unmount();

    const narrowed = render(
      <Harness onAttachMenuSelect={() => {}} onAttachmentsChange={() => {}} attachMenuActions={["add-media", "edit-media"]} />
    );
    await narrowed.getByRole("button", { name: "Add media" }).click();
    await expect.element(narrowed.getByRole("menuitem", { name: "Edit image" })).toBeVisible();
    await expect.element(narrowed.getByRole("menuitem", { name: "Create video" })).not.toBeInTheDocument();
  });

  it("in edit mode, a new image replaces the one being edited", async () => {
    function Editing() {
      const [attachments, setAttachments] = useState<ComposerAttachment[]>([
        { id: "old", src: "data:image/png;base64,old", kind: "image", name: "old.png" },
      ]);
      return (
        <>
          <Harness useCase={{ kind: "image", label: "Edit image", edit: true }} attachments={attachments} onAttachmentsChange={setAttachments} />
          <p data-testid="names">{attachments.map((a) => a.name).join(",")}</p>
        </>
      );
    }
    const screen = render(<Editing />);
    // One image at a time: the picker takes a single image file.
    expect(fileInput().multiple).toBe(false);
    expect(fileInput().accept).toBe("image/*");
    await userEvent.upload(fileInput(), file("new.png", "image/png"));
    await expect.element(screen.getByTestId("names")).toHaveTextContent(/^new\.png$/);
  });

  it("in edit mode, reports a file that isn't an image and keeps the current one", async () => {
    const onUnsupportedFile = vi.fn();
    const onAttachmentsChange = vi.fn();
    const attachments: ComposerAttachment[] = [{ id: "old", src: "data:image/png;base64,old", kind: "image", name: "old.png" }];
    render(
      <Harness
        useCase={{ kind: "image", label: "Edit image", edit: true }}
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        onUnsupportedFile={onUnsupportedFile}
      />
    );
    await userEvent.upload(fileInput(), file("clip.mp4", "video/mp4"));
    expect(onUnsupportedFile).toHaveBeenCalledWith("clip.mp4");
    expect(onAttachmentsChange).not.toHaveBeenCalled();
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

  it("offers Chai's suggested models when the app passes none, with the first picked", async () => {
    const onSubmit = vi.fn();
    const screen = render(<Harness initialValue="a mug" useCase={IMAGE} onSubmit={onSubmit} />);
    await expect.element(screen.getByText("Nano Banana Pro")).toBeInTheDocument();
    // The first model's aspect ratios fill the menu.
    await expect.element(screen.getByText("Aspect ratio")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: "fal-ai/nano-banana-pro" });
    expect(onSubmit.mock.calls[0]![0].selections[0].models.length).toBeGreaterThan(1);
  });

  it("suggests edit models in edit mode, and none for a text request", async () => {
    const edit = render(<Harness useCase={{ kind: "image", label: "Edit image", edit: true }} />);
    await expect.element(edit.getByText("Flux 3 Image")).toBeInTheDocument();
    edit.unmount();
    const text = render(<Harness />);
    await expect.element(text.getByText("Select models")).not.toBeInTheDocument();
  });

  it("hides the Model and Aspect ratio menus with nowhere for a pick to go, and still runs the first suggested model", async () => {
    const onSubmit = vi.fn();
    const screen = render(
      <Composer value="a mug" onChange={() => {}} useCase={IMAGE} onSubmit={onSubmit} />
    );
    await expect.element(screen.getByText("Nano Banana Pro")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Aspect ratio")).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: "fal-ai/nano-banana-pro" });
  });

  it("never submits a model that isn't in the current list", async () => {
    const onSubmit = vi.fn();
    const screen = render(<Harness initialValue="a mug" useCase={IMAGE} models={MODELS} modelId="gone/model" onSubmit={onSubmit} />);
    await expect.element(screen.getByText("Select models")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ modelId: null });
    expect(onSubmit.mock.calls[0]![0].selections[0].modelIds).toEqual([]);
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
