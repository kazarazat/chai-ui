import { describe, expect, it } from "vitest";
import {
  clampPan,
  editCardWidth,
  fitBox,
  freeRegionNumber,
  newRegion,
  panForKey,
  panForZoom,
  regionBoxForKey,
  regionBoxStyle,
  regionPopoverPosition,
  resizeBox,
} from "./edit-card.js";
import type { EditRegion } from "./region-edit.js";

const box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };
const size = { width: 400, height: 600 };
const region = (number: number): EditRegion => ({ id: `r${number}`, number, box, prompt: "" });

describe("EditCard geometry", () => {
  it("keeps boxes inside the image and above the minimum size", () => {
    expect(fitBox({ x: 0.95, y: -1, width: 0.2, height: 0.001 })).toEqual({ x: 0.8, y: 0, width: 0.2, height: 0.03 });
    const grown = resizeBox(box, "nw", -0.1, -0.1);
    for (const [key, value] of Object.entries({ x: 0.3, y: 0.3, width: 0.3, height: 0.3 })) expect(grown[key as keyof typeof grown]).toBeCloseTo(value);
    expect(resizeBox(box, "se", 1, 1)).toMatchObject({ x: 0.4, y: 0.4 });
    expect(resizeBox(box, "ne", -1, 0).width).toBeCloseTo(0.03);
  });

  it("moves a region with arrows, resizes with Shift, and takes bigger steps with Alt", () => {
    expect(regionBoxForKey(box, "ArrowRight")!.x).toBeCloseTo(0.41);
    expect(regionBoxForKey(box, "ArrowLeft", { alt: true })!.x).toBeCloseTo(0.35);
    expect(regionBoxForKey(box, "ArrowDown", { shift: true })!.height).toBeCloseTo(0.21);
    expect(regionBoxForKey(box, "ArrowUp")!.y).toBeCloseTo(0.39);
    expect(regionBoxForKey(box, "Enter")).toBeNull();
  });

  it("keeps the zoomed image covering the view, zooming around the middle and panning by key", () => {
    expect(clampPan({ x: 10, y: -10000 }, 2, size)).toEqual({ x: 0, y: -600 });
    expect(panForZoom({ x: 0, y: 0 }, 1, 2, size)).toEqual({ x: -200, y: -300 });
    expect(panForKey({ x: -100, y: -100 }, "ArrowLeft", 2, size)).toEqual({ x: -60, y: -100 });
    expect(panForKey({ x: -100, y: -100 }, "ArrowDown", 2, size)).toEqual({ x: -100, y: -140 });
    expect(panForKey({ x: 0, y: 0 }, "a", 2, size)).toBeNull();
  });

  it("numbers a new region with the lowest free number, centered in view", () => {
    expect(freeRegionNumber([region(1), region(3)])).toBe(2);
    const added = newRegion([region(1)], 1, { x: 0, y: 0 }, size);
    expect(added).toMatchObject({ number: 2, prompt: "", box: { x: 0.35, y: 0.4, width: 0.3, height: 0.2 } });
    // Zoomed into the top left quarter, it lands there.
    expect(newRegion([], 2, { x: 0, y: 0 }, size).box.x).toBeCloseTo(0.175);
    expect(newRegion([], 1, { x: 0, y: 0 }, { width: 0, height: 0 }).box.x).toBeCloseTo(0.35);
  });

  it("places the instruction field above a region, or below one at the top", () => {
    expect(regionPopoverPosition(box, 1, { x: 0, y: 0 }, size, false)).toEqual({ left: 160, top: 232, above: true });
    expect(regionPopoverPosition({ ...box, y: 0.05 }, 1, { x: 0, y: 0 }, size, true)).toMatchObject({ above: false, top: 158 });
  });

  it("sizes the card from scale, width or the maximums, keeping the image's shape", () => {
    const limits = { maxWidth: 630, maxHeight: 630 };
    expect(editCardWidth(null, limits)).toBe(630);
    expect(editCardWidth({ width: 400, height: 600 }, limits)).toBe(420);
    expect(editCardWidth({ width: 400, height: 600 }, { ...limits, scale: 0.5 })).toBe(200);
    expect(editCardWidth(null, { ...limits, width: 300 })).toBe(300);
  });

  it("styles a region box in percentages with its color", () => {
    expect(regionBoxStyle(region(1))).toEqual({
      left: "40%",
      top: "40%",
      width: "20%",
      height: "20%",
      "--chai-region-color": "var(--chai-color-semantic-region-1)",
    });
  });
});
