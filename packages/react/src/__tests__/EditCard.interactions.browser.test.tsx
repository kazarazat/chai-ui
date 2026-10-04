import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import type { EditRegion } from "@chai-ui/core";
import { EditCard, type EditCardProps, type EditVersion } from "../EditCard.js";

const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#09f"/></svg>')}`;
const original: EditVersion = { id: "original", src: svg, status: "done", regions: [] };
const region = (number: number, prompt: string): EditRegion => ({
  id: `r${number}`,
  number,
  box: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
  prompt,
});

function Harness({ initialRegions = [], onRegions, ...props }: Partial<EditCardProps> & { initialRegions?: EditRegion[]; onRegions?: (r: EditRegion[]) => void }) {
  const [regions, setRegions] = useState(initialRegions);
  return (
    <EditCard
      versions={[original]}
      activeVersion={0}
      onActiveVersionChange={() => {}}
      regions={regions}
      onRegionsChange={(next) => {
        setRegions(next);
        onRegions?.(next);
      }}
      {...props}
    />
  );
}

// Synthetic pointer events can't take real pointer capture; the drag logic is what's under test.
beforeEach(() => {
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

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

describe("EditCard instruction field", () => {
  it("Enter checks a new region in; Escape throws a new one away", async () => {
    const onRegions = vi.fn();
    const screen = render(<Harness onRegions={onRegions} />);
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
    const screen = render(<Harness initialRegions={[region(1, "old")]} onRegions={onRegions} />);
    await screen.getByRole("button", { name: /^Region 1/ }).click();
    await userEvent.fill(screen.getByRole("textbox"), "new");
    await screen.getByRole("button", { name: "Add region to prompt" }).click();
    expect(onRegions).toHaveBeenLastCalledWith([expect.objectContaining({ id: "r1", prompt: "new" })]);
  });
});

describe("EditCard keyboard", () => {
  it("Delete removes the focused region; Backspace removes a new one", async () => {
    const onRegions = vi.fn();
    const screen = render(<Harness initialRegions={[region(1, "x")]} onRegions={onRegions} />);
    (screen.getByRole("button", { name: /^Region 1/ }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Delete}");
    expect(onRegions).toHaveBeenLastCalledWith([]);

    await screen.getByRole("button", { name: "New region" }).click();
    (screen.getByRole("button", { name: /^Region 1/ }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Backspace}");
    expect(document.querySelectorAll(".chai-edit-card__region")).toHaveLength(0);
  });

  it("arrow keys pan the zoomed image", async () => {
    const screen = render(<Harness />);
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
    const screen = render(<Harness initialRegions={[region(1, "x")]} onRegions={onRegions} />);
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
    const screen = render(<Harness initialRegions={[region(1, "x")]} />);
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
    const screen = render(<Harness onAction={onAction} />);
    await screen.getByRole("button", { name: "Download" }).click();
    await expect.poll(() => onAction.mock.calls.length).toBe(1);
    await screen.getByRole("button", { name: "Share" }).click();
    await expect.poll(() => onAction.mock.calls.length).toBe(2);
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["download", "share"]);
  });

  it("expands to a dialog that keeps focus and closes with Escape or the backdrop", async () => {
    const screen = render(<Harness />);
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
    const screen = render(
      <EditCard
        versions={[original, { id: "c", status: "cancelled", regions: [] }, { id: "e", status: "error", regions: [], error: "Timed out." }]}
        activeVersion={1}
        onActiveVersionChange={() => {}}
        regions={[]}
        onRegionsChange={() => {}}
        width={300}
      />
    );
    await expect.element(screen.getByText("Stopped")).toBeVisible();
    expect(document.querySelector(".chai-edit-card__placeholder")).not.toBeNull();
    expect((document.querySelector(".chai-edit-card") as HTMLElement).style.getPropertyValue("--chai-edit-card-width")).toBe("300px");
    screen.rerender(
      <EditCard
        versions={[original, { id: "c", status: "cancelled", regions: [] }, { id: "e", status: "error", regions: [], error: "Timed out." }]}
        activeVersion={2}
        onActiveVersionChange={() => {}}
        regions={[]}
        onRegionsChange={() => {}}
      />
    );
    await expect.element(screen.getByText("Timed out.")).toBeVisible();
  });

  it("renders nothing without versions", () => {
    render(<EditCard versions={[]} activeVersion={0} onActiveVersionChange={() => {}} regions={[]} onRegionsChange={() => {}} />);
    expect(document.querySelector(".chai-edit-card")).toBeNull();
  });
});
