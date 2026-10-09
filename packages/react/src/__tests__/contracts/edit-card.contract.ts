import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { EditRegion, EditVersion } from "@chai-ui/core";
import { wcagViolations } from "../axe.js";
import { controlled, type Render } from "./render.js";

export interface EditCardProps {
  versions: EditVersion[];
  activeVersion: number;
  onActiveVersionChange: (index: number) => void;
  regions: EditRegion[];
  onRegionsChange: (next: EditRegion[]) => void;
  maxRegions?: number;
  width?: number;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  onAction?: (action: "download" | "share", version: EditVersion) => void;
}

const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#09f"/></svg>')}`;
const original: EditVersion = { id: "original", src: svg, status: "done", regions: [] };
const regionOf = (width: number) => (number: number, prompt: string): EditRegion => ({
  id: `r${number}`,
  number,
  box: { x: 0.4, y: 0.4, width, height: 0.2 },
  prompt,
});
const region = regionOf(0.2);
const wide = regionOf(0.3);

function pointer(target: Element, type: string, x: number, y: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
}

/** Drags from the middle of `from` by (dx, dy) pixels. */
function drag(from: Element, dx: number, dy: number) {
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  pointer(from, "pointerdown", x, y);
  pointer(from, "pointermove", x + dx, y + dy);
  pointer(from, "pointerup", x + dx, y + dy);
}

const viewport = () => document.querySelector(".chai-edit-card__viewport")!;
/** The card measures itself with a ResizeObserver, which reports just after render. */
const measured = () => new Promise((resolve) => setTimeout(resolve, 100));
const layerTransform = () => (document.querySelector(".chai-edit-card__layer") as HTMLElement).style.transform;

export function editCardContract(render: Render<EditCardProps>) {
  /** An EditCard whose regions and version are held the way useComposer holds them. */
  const harness = (props: Partial<EditCardProps> = {}) =>
    controlled<EditCardProps>(
      render,
      { versions: [original], activeVersion: 0, onActiveVersionChange: () => {}, regions: [], onRegionsChange: () => {}, ...props },
      { onActiveVersionChange: "activeVersion", onRegionsChange: "regions" }
    );

  beforeEach(() => {
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe("EditCard", () => {
    it("fits inside maxWidth and maxHeight, keeping the image's shape", async () => {
      const image = (screen: { container: HTMLElement }) =>
        screen.container.querySelector<HTMLElement>(".chai-edit-card__image")!.getBoundingClientRect();
      // The test image is 400 × 600. A 450px max height narrows it to 300 × 450.
      const tall = harness({ maxHeight: 450 });
      await expect.poll(() => Math.round(image(tall).width)).toBe(300);
      expect(Math.round(image(tall).height)).toBe(450);
      tall.unmount();

      const narrow = harness({ maxWidth: 250 });
      await expect.poll(() => Math.round(image(narrow).width)).toBe(250);
    });

    it("sizes itself from the image's own width with scale", async () => {
      const screen = harness({ scale: 0.5 });
      const image = () => screen.container.querySelector<HTMLElement>(".chai-edit-card__image")!;
      // The test image is 400px wide, so it shows at 200px.
      await expect.poll(() => image().getBoundingClientRect().width).toBe(200);
    });

    it("adds a region, describes it, and checks it in", async () => {
      const onRegions = vi.fn();
      const screen = harness({ onRegionsChange: onRegions });
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
      const screen = harness({ regions: [wide(1, "make it green")] });
      await screen.getByRole("button", { name: /^Region 1/ }).click();

      const check = screen.getByRole("button", { name: "Add region to prompt" });
      await expect.element(check).toBeDisabled();
      await expect.element(screen.getByRole("button", { name: "Delete region" })).toBeEnabled();
      await userEvent.type(screen.getByRole("textbox", { name: "Instruction for region 1" }), " and shiny");
      await expect.element(check).toBeEnabled();
    });

    it("deletes a region with trash", async () => {
      const onRegions = vi.fn();
      const screen = harness({ regions: [wide(1, "x"), wide(2, "y")], onRegionsChange: onRegions });
      await screen.getByRole("button", { name: /^Region 2/ }).click();
      await screen.getByRole("button", { name: "Delete region" }).click();
      expect(onRegions).toHaveBeenLastCalledWith([expect.objectContaining({ number: 1 })]);
    });

    it("moves the selected region with the arrow keys and resizes it with Shift", async () => {
      const onRegions = vi.fn();
      const screen = harness({ regions: [wide(1, "x")], onRegionsChange: onRegions });
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
      const screen = harness({ onRegionsChange: onRegions });
      await screen.getByRole("button", { name: "New region" }).click();
      await screen.rerender({ regions: [wide(1, "a"), wide(2, "b")] });
      await userEvent.type(screen.getByRole("textbox", { name: "Instruction for region 3" }), "c");
      await screen.getByRole("button", { name: "Add region to prompt" }).click();
      expect(onRegions.mock.lastCall![0].map((r: EditRegion) => r.number)).toEqual([1, 2, 3]);
    });

    it("enables Clear regions only with new regions, and clears them", async () => {
      const onRegions = vi.fn();
      const empty = harness();
      await expect.element(empty.getByRole("button", { name: "Clear regions" })).toBeDisabled();
      empty.unmount();

      const screen = harness({ regions: [wide(1, "x")], onRegionsChange: onRegions });
      await screen.getByRole("button", { name: "Clear regions" }).click();
      expect(onRegions).toHaveBeenLastCalledWith([]);
    });

    it("hides and shows the regions", async () => {
      const screen = harness({ regions: [wide(1, "x")] });
      await screen.getByRole("button", { name: "Hide regions" }).click();
      await expect.element(screen.getByRole("button", { name: /^Region 1/ })).not.toBeInTheDocument();
      await screen.getByRole("button", { name: "Show regions" }).click();
      await expect.element(screen.getByRole("button", { name: /^Region 1/ })).toBeInTheDocument();
    });

    it("stops new regions at the model's cap", async () => {
      const screen = harness({ regions: [wide(1, "x"), wide(2, "y")], maxRegions: 2 });
      await expect.element(screen.getByRole("button", { name: "New region" })).toBeDisabled();
    });

    it("zooms in and out, keeping the image inside the card", async () => {
      const screen = harness();
      await expect.element(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
      await screen.getByRole("button", { name: "Zoom in" }).click();
      await expect.element(screen.getByText("125%")).toBeVisible();
      await expect.element(screen.getByRole("group", { name: /zoomed to 125%/ })).toBeInTheDocument();
      await screen.getByRole("button", { name: "Zoom out" }).click();
      await expect.element(screen.getByText("100%")).toBeVisible();
    });

    it("pages between versions and shows an edit in progress over the image it came from", async () => {
      const onChange = vi.fn();
      const versions: EditVersion[] = [original, { id: "e1", from: original.src, status: "running", regions: [wide(1, "x")] }];
      const screen = render({ versions, activeVersion: 1, onActiveVersionChange: onChange, regions: [], onRegionsChange: () => {} });
      await expect.element(screen.getByLabelText("Editing")).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "New region" })).toBeDisabled();
      await expect.element(screen.getByRole("slider", { name: "Versions" })).toHaveAttribute("aria-valuetext", "Version 2 of 2");
      await screen.getByRole("slider", { name: "Versions" }).click({ position: { x: 4, y: 12 } });
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe("EditCard instruction field", () => {
    it("Enter checks a new region in; Escape throws a new one away", async () => {
      const onRegions = vi.fn();
      const screen = harness({ onRegionsChange: onRegions });
      await screen.getByRole("button", { name: "New region" }).click();
      await userEvent.type(screen.getByRole("textbox"), "Make it green{Enter}");
      expect(onRegions).toHaveBeenLastCalledWith([expect.objectContaining({ number: 1, prompt: "Make it green" })]);

      await screen.getByRole("button", { name: "New region" }).click();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
      expect(document.querySelectorAll(".chai-edit-card__region")).toHaveLength(1);
    });

    it("updates a checked region's instruction", async () => {
      const onRegions = vi.fn();
      const screen = harness({ regions: [region(1, "old")], onRegionsChange: onRegions });
      await screen.getByRole("button", { name: /^Region 1/ }).click();
      await userEvent.fill(screen.getByRole("textbox"), "new");
      await screen.getByRole("button", { name: "Add region to prompt" }).click();
      expect(onRegions).toHaveBeenLastCalledWith([expect.objectContaining({ id: "r1", prompt: "new" })]);
    });
  });

  describe("EditCard keyboard", () => {
    it("Delete removes the focused region; Backspace removes a new one", async () => {
      const onRegions = vi.fn();
      const screen = harness({ regions: [region(1, "x")], onRegionsChange: onRegions });
      (screen.getByRole("button", { name: /^Region 1/ }).element() as HTMLElement).focus();
      await userEvent.keyboard("{Delete}");
      expect(onRegions).toHaveBeenLastCalledWith([]);

      await screen.getByRole("button", { name: "New region" }).click();
      (screen.getByRole("button", { name: /^Region 1/ }).element() as HTMLElement).focus();
      await userEvent.keyboard("{Backspace}");
      expect(document.querySelectorAll(".chai-edit-card__region")).toHaveLength(0);
    });

    it("arrow keys pan the zoomed image", async () => {
      const screen = harness();
      await screen.getByRole("button", { name: "Zoom in" }).click();
      await screen.getByRole("button", { name: "Zoom in" }).click();
      const before = layerTransform();
      (viewport() as HTMLElement).focus();
      await userEvent.keyboard("{ArrowRight}");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(layerTransform).not.toBe(before);
      // Other keys leave it alone.
      const after = layerTransform();
      await userEvent.keyboard("a");
      expect(layerTransform()).toBe(after);
    });
  });

  describe("EditCard pointer", () => {
    it("drags a region to move it and a corner to resize it", async () => {
      const onRegions = vi.fn();
      const screen = harness({ regions: [region(1, "x")], onRegionsChange: onRegions });
      await measured();
      const body = screen.getByRole("button", { name: /^Region 1/ }).element();
      drag(body, 40, 20);
      const moved = onRegions.mock.lastCall![0][0].box;
      expect(moved.x).toBeGreaterThan(0.4);
      expect(moved.y).toBeGreaterThan(0.4);

      // Selected now, so it shows its corner handles.
      const se = await vi.waitFor(() => {
        const h = document.querySelector(".chai-edit-card__handle--se");
        if (!h) throw new Error("no handle yet");
        return h;
      });
      drag(se, 30, 30);
      const resized = onRegions.mock.lastCall![0][0].box;
      expect(resized.width).toBeGreaterThan(moved.width);
      expect(resized.height).toBeGreaterThan(moved.height);

      const nw = document.querySelector(".chai-edit-card__handle--nw")!;
      drag(nw, -20, -20);
      expect(onRegions.mock.lastCall![0][0].box.x).toBeLessThan(resized.x);
    });

    it("drags the zoomed image to pan, and a plain click closes the open field", async () => {
      const screen = harness({ regions: [region(1, "x")] });
      await screen.getByRole("button", { name: /^Region 1/ }).click();
      await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
      const r = viewport().getBoundingClientRect();
      pointer(viewport(), "pointerdown", r.left + 5, r.top + 5);
      pointer(viewport(), "pointerup", r.left + 5, r.top + 5);
      await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

      await screen.getByRole("button", { name: "Zoom in" }).click();
      const before = layerTransform();
      pointer(viewport(), "pointerdown", r.left + 100, r.top + 100);
      pointer(viewport(), "pointermove", r.left + 60, r.top + 60);
      pointer(viewport(), "pointerup", r.left + 60, r.top + 60);
      // Pointer moves render on the next frame.
      await expect.poll(layerTransform).not.toBe(before);
    });
  });

  describe("EditCard media actions and states", () => {
    it("downloads and shares the version showing", async () => {
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const onAction = vi.fn();
      const screen = harness({ onAction });
      await screen.getByRole("button", { name: "Download" }).click();
      await expect.poll(() => onAction.mock.calls.length).toBe(1);
      await screen.getByRole("button", { name: "Share" }).click();
      await expect.poll(() => onAction.mock.calls.length).toBe(2);
      expect(onAction.mock.calls.map((c) => c[0])).toEqual(["download", "share"]);
    });

    it("expands to a dialog that keeps focus and closes with Escape or the backdrop", async () => {
      const screen = harness();
      await screen.getByRole("button", { name: "Expand" }).click();
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();
      await userEvent.keyboard("{Tab}");
      await expect.element(screen.getByRole("button", { name: "Collapse" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("dialog", { name: "Expanded image" })).not.toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Expand" })).toHaveFocus();

      await screen.getByRole("button", { name: "Expand" }).click();
      (document.querySelector(".chai-result-card__expand-scrim") as HTMLElement).click();
      await expect.element(screen.getByRole("dialog", { name: "Expanded image" })).not.toBeInTheDocument();
    });

    it("says when an edit was stopped or failed, and holds space with no image yet", async () => {
      const screen = render({ versions: [original, { id: "c", status: "cancelled", regions: [] }, { id: "e", status: "error", regions: [], error: "Timed out." }], activeVersion: 1, onActiveVersionChange: () => {}, regions: [], onRegionsChange: () => {}, width: 300 });
      await expect.element(screen.getByText("Stopped")).toBeVisible();
      expect(document.querySelector(".chai-edit-card__placeholder")).not.toBeNull();
      expect((document.querySelector(".chai-edit-card") as HTMLElement).style.getPropertyValue("--chai-edit-card-width")).toBe("300px");
      screen.rerender({ versions: [original, { id: "c", status: "cancelled", regions: [] }, { id: "e", status: "error", regions: [], error: "Timed out." }], activeVersion: 2, onActiveVersionChange: () => {}, regions: [], onRegionsChange: () => {} });
      await expect.element(screen.getByText("Timed out.")).toBeVisible();
    });

    it("renders nothing without versions", () => {
      render({ versions: [], activeVersion: 0, onActiveVersionChange: () => {}, regions: [], onRegionsChange: () => {} });
      expect(document.querySelector(".chai-edit-card")).toBeNull();
    });
  });

    describe("EditCard accessibility", () => {
      it("passes axe: regions, the open instruction field, zoomed, and an edit in progress", async () => {
        const regions = [
          { id: "r1", number: 1, box: { x: 0.1, y: 0.4, width: 0.3, height: 0.2 }, prompt: "make it green" },
          { id: "r2", number: 2, box: { x: 0.5, y: 0.5, width: 0.3, height: 0.2 }, prompt: "" },
        ];
        const versions: EditVersion[] = [original, { id: "e1", from: original.src, status: "running", regions }];
        const screen = render({ versions, activeVersion: 0, onActiveVersionChange: () => {}, regions, onRegionsChange: () => {} });
        expect(await wcagViolations()).toEqual([]);
        await screen.getByRole("button", { name: /^Region 1/ }).click();
        expect(await wcagViolations()).toEqual([]);
        await screen.getByRole("button", { name: "Zoom in" }).click();
        expect(await wcagViolations()).toEqual([]);
        await screen.rerender({ versions, activeVersion: 1, onActiveVersionChange: () => {}, regions: [], onRegionsChange: () => {} });
        expect(await wcagViolations()).toEqual([]);
      });
    });
}
