import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { ModelOption } from "@chai-ui/core";
import { Composer, TEXT_USE_CASE, type ComposerProps } from "../Composer.js";

const IMAGE = { kind: "image" as const, label: "Image" };
const MODELS: ModelOption[] = [
  { id: "fal/fast", label: "Fast Image", provider: "fal", speed: "fast" },
  { id: "fal/pro", label: "Pro Image", provider: "fal", speed: "standard" },
];

/** Composer with its prompt text held in real state, like an app would. */
function Harness(props: Partial<ComposerProps> & { initialValue?: string }) {
  const { initialValue = "", ...rest } = props;
  const [value, setValue] = useState(initialValue);
  return <Composer value={value} onChange={setValue} onSubmit={() => {}} {...rest} />;
}

describe("Composer", () => {
  it("submits the typed prompt as a text request when no use case is picked", async () => {
    const onSubmit = vi.fn();
    const screen = render(<Harness onSubmit={onSubmit} />);
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
    const screen = render(<Harness initialValue="a mug" useCase={IMAGE} models={MODELS} modelId="fal/pro" onSubmit={onSubmit} />);
    await expect.element(screen.getByText("Pro Image")).toBeVisible();
    await screen.getByRole("button", { name: "Submit" }).click();
    expect(onSubmit.mock.calls[0]![0].selections).toEqual([{ useCase: IMAGE, modelIds: ["fal/pro"], models: MODELS }]);
  });

  it("turning auto-select on clears the pick and reads Auto-select until routing picks", async () => {
    const onModelChange = vi.fn();
    const props = { initialValue: "a mug", useCase: IMAGE, models: MODELS, onModelChange };
    const screen = render(<Harness {...props} modelId="fal/pro" autoSelectModel={false} />);
    screen.rerender(<Harness {...props} modelId="fal/pro" autoSelectModel />);
    expect(onModelChange).toHaveBeenCalledWith(null);

    screen.rerender(<Harness {...props} modelId={null} autoSelectModel />);
    await expect.element(screen.getByText("Auto-select")).toBeVisible();
  });

  it("optimize then undo restores the original prompt", async () => {
    const rewrite = "a red ceramic mug on oak, ".repeat(12); // past the reveal's length cap, so no animation
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
              setValue(rewrite);
              setEnhancing(false);
            }, 20);
          }}
        />
      );
    }
    const screen = render(<Enhancing />);
    await screen.getByRole("button", { name: "Optimize prompt" }).click();
    await expect.element(screen.getByRole("textbox")).toHaveValue(rewrite);

    await screen.getByRole("button", { name: "Revert to original prompt" }).click();
    await expect.element(screen.getByRole("textbox")).toHaveValue("a mug");
    await expect.element(screen.getByRole("button", { name: "Optimize prompt" })).toBeVisible();
  });

  it("shows a stop button while submitting, wired to onAbort", async () => {
    const onAbort = vi.fn();
    const screen = render(<Harness initialValue="a mug" submitting onAbort={onAbort} />);
    await screen.getByRole("button", { name: "Stop" }).click();
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});
