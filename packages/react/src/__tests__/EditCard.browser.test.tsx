import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { EditRegion } from "@chai-ui/core";
import { EditCard, type EditCardProps, type EditVersion } from "../EditCard.js";

const svg = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="${fill}"/></svg>`)}`;
const original: EditVersion = { id: "original", src: svg("#09f"), status: "done", regions: [] };
const region = (number: number, prompt: string): EditRegion => ({
  id: `r${number}`,
  number,
  box: { x: 0.4, y: 0.4, width: 0.3, height: 0.2 },
  prompt,
});

/** EditCard with its regions and version held in real state, like useComposer holds them. */
function Harness({
  initialRegions = [],
  onRegions,
  ...props
}: Partial<EditCardProps> & { initialRegions?: EditRegion[]; onRegions?: (r: EditRegion[]) => void }) {
  const [regions, setRegions] = useState(initialRegions);
  const [active, setActive] = useState(0);
  return (
    <EditCard
      versions={[original]}
      activeVersion={active}
      onActiveVersionChange={setActive}
      regions={regions}
      onRegionsChange={(next) => {
        setRegions(next);
        onRegions?.(next);
      }}
      {...props}
    />
  );
}

describe("EditCard", () => {
  it("fits inside maxWidth and maxHeight, keeping the image's shape", async () => {
    const image = (screen: { container: HTMLElement }) =>
      screen.container.querySelector<HTMLElement>(".chai-edit-card__image")!.getBoundingClientRect();
    // The test image is 400 × 600. A 450px max height narrows it to 300 × 450.
    const tall = render(<Harness maxHeight={450} />);
    await expect.poll(() => Math.round(image(tall).width)).toBe(300);
    expect(Math.round(image(tall).height)).toBe(450);
    tall.unmount();

    const narrow = render(<Harness maxWidth={250} />);
    await expect.poll(() => Math.round(image(narrow).width)).toBe(250);
  });

  it("sizes itself from the image's own width with scale", async () => {
    const screen = render(<Harness scale={0.5} />);
    const image = () => screen.container.querySelector<HTMLElement>(".chai-edit-card__image")!;
    // The test image is 400px wide, so it shows at 200px.
    await expect.poll(() => image().getBoundingClientRect().width).toBe(200);
  });

  it("adds a region, describes it, and checks it in", async () => {
    const onRegions = vi.fn();
    const screen = render(<Harness onRegions={onRegions} />);
    await screen.getByRole("button", { name: "New region" }).click();

    const check = screen.getByRole("button", { name: "Add region to prompt" });
    await expect.element(check).toBeDisabled();
    const field = screen.getByRole("textbox", { name: "Instruction for region 1" });
    await expect.element(field).toHaveFocus();
    // The field floats over the image, styled, next to its region.
    expect(getComputedStyle(screen.getByRole("dialog").element()).position).toBe("absolute");
    await userEvent.type(field, "Change Manager to Boss");
    await check.click();

    expect(onRegions).toHaveBeenLastCalledWith([
      expect.objectContaining({ number: 1, prompt: "Change Manager to Boss" }),
    ]);
    await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /^Region 1: Change Manager to Boss/ })).toBeInTheDocument();
  });

  it("reopens a checked region with check off until its instruction changes", async () => {
    const screen = render(<Harness initialRegions={[region(1, "make it green")]} />);
    await screen.getByRole("button", { name: /^Region 1/ }).click();

    const check = screen.getByRole("button", { name: "Add region to prompt" });
    await expect.element(check).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Delete region" })).toBeEnabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Instruction for region 1" }), " and shiny");
    await expect.element(check).toBeEnabled();
  });

  it("deletes a region with trash", async () => {
    const onRegions = vi.fn();
    const screen = render(<Harness initialRegions={[region(1, "x"), region(2, "y")]} onRegions={onRegions} />);
    await screen.getByRole("button", { name: /^Region 2/ }).click();
    await screen.getByRole("button", { name: "Delete region" }).click();
    expect(onRegions).toHaveBeenLastCalledWith([expect.objectContaining({ number: 1 })]);
  });

  it("moves the selected region with the arrow keys and resizes it with Shift", async () => {
    const onRegions = vi.fn();
    const screen = render(<Harness initialRegions={[region(1, "x")]} onRegions={onRegions} />);
    const box = screen.getByRole("button", { name: /^Region 1/ });
    await box.click();
    // Focus is in the instruction field; go back to the region.
    (box.element() as HTMLElement).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(onRegions.mock.lastCall![0][0].box.x).toBeCloseTo(0.41);
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onRegions.mock.lastCall![0][0].box.height).toBeCloseTo(0.21);
  });

  it("gives a region being drawn a free number when regions arrive from outside meanwhile", async () => {
    const onRegions = vi.fn();
    function Outside() {
      const [regions, setRegions] = useState<EditRegion[]>([]);
      return (
        <>
          <button type="button" onClick={() => setRegions([region(1, "a"), region(2, "b")])}>
            Load two
          </button>
          <EditCard
            versions={[original]}
            activeVersion={0}
            onActiveVersionChange={() => {}}
            regions={regions}
            onRegionsChange={(next) => {
              setRegions(next);
              onRegions(next);
            }}
          />
        </>
      );
    }
    const screen = render(<Outside />);
    await screen.getByRole("button", { name: "New region" }).click();
    await screen.getByRole("button", { name: "Load two" }).click();
    await userEvent.type(screen.getByRole("textbox", { name: "Instruction for region 3" }), "c");
    await screen.getByRole("button", { name: "Add region to prompt" }).click();
    expect(onRegions.mock.lastCall![0].map((r: EditRegion) => r.number)).toEqual([1, 2, 3]);
  });

  it("enables Clear regions only with new regions, and clears them", async () => {
    const onRegions = vi.fn();
    const empty = render(<Harness />);
    await expect.element(empty.getByRole("button", { name: "Clear regions" })).toBeDisabled();
    empty.unmount();

    const screen = render(<Harness initialRegions={[region(1, "x")]} onRegions={onRegions} />);
    await screen.getByRole("button", { name: "Clear regions" }).click();
    expect(onRegions).toHaveBeenLastCalledWith([]);
  });

  it("hides and shows the regions", async () => {
    const screen = render(<Harness initialRegions={[region(1, "x")]} />);
    await screen.getByRole("button", { name: "Hide regions" }).click();
    await expect.element(screen.getByRole("button", { name: /^Region 1/ })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Show regions" }).click();
    await expect.element(screen.getByRole("button", { name: /^Region 1/ })).toBeInTheDocument();
  });

  it("stops new regions at the model's cap", async () => {
    const screen = render(<Harness initialRegions={[region(1, "x"), region(2, "y")]} maxRegions={2} />);
    await expect.element(screen.getByRole("button", { name: "New region" })).toBeDisabled();
  });

  it("zooms in and out, keeping the image inside the card", async () => {
    const screen = render(<Harness />);
    await expect.element(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    await screen.getByRole("button", { name: "Zoom in" }).click();
    await expect.element(screen.getByText("125%")).toBeVisible();
    await expect.element(screen.getByRole("group", { name: /zoomed to 125%/ })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Zoom out" }).click();
    await expect.element(screen.getByText("100%")).toBeVisible();
  });

  it("pages between versions and shows an edit in progress over the image it came from", async () => {
    const onChange = vi.fn();
    const versions: EditVersion[] = [original, { id: "e1", from: original.src, status: "running", regions: [region(1, "x")] }];
    const screen = render(
      <EditCard versions={versions} activeVersion={1} onActiveVersionChange={onChange} regions={[]} onRegionsChange={() => {}} />
    );
    await expect.element(screen.getByLabelText("Editing")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "New region" })).toBeDisabled();
    await expect.element(screen.getByRole("slider", { name: "Versions" })).toHaveAttribute("aria-valuetext", "Version 2 of 2");
    await screen.getByRole("slider", { name: "Versions" }).click({ position: { x: 4, y: 12 } });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
