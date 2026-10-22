/**
 * `fitImageToRatio` draws on a canvas, which only a real browser has, so
 * it's checked here (Chromium) rather than in core's jsdom tests.
 */
import { describe, expect, it } from "vitest";
import { fitImageToRatio } from "@chai-ui/core";

function square(size: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.fillRect(0, 0, size, size);
  return canvas.toDataURL("image/png");
}

function sizeOf(src: string): Promise<[number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.src = src;
  });
}

describe("fitImageToRatio", () => {
  it("crops a square to 16:9 by cutting its height, and pads it by growing its width", async () => {
    expect(await sizeOf(await fitImageToRatio(square(160), "16:9", "crop"))).toEqual([160, 90]);
    expect(await sizeOf(await fitImageToRatio(square(90), "16:9", "pad"))).toEqual([160, 90]);
  });

  it("leaves an image that already has the ratio as it is", async () => {
    const src = square(100);
    expect(await fitImageToRatio(src, "1:1", "crop")).toBe(src);
  });
});
