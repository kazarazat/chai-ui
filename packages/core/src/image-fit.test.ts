// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fitImageToRatio, fitImagesToRatio } from "./image-fit.js";

/**
 * jsdom has no canvas, so these stand one in to check the geometry; the
 * real drawing is checked in Chromium (react's image-fit.browser.test).
 */
function stubDrawing(natural: [number, number], { loads = true, readable = true } = {}) {
  const ctx = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: () => {
      if (!readable) throw new Error("tainted");
      return `fitted:${canvas.width}x${canvas.height}`;
    },
  };
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
    tag === "canvas" ? canvas : create(tag)) as typeof document.createElement);
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = natural[0];
      naturalHeight = natural[1];
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => (loads ? this.onload?.() : this.onerror?.()));
      }
    }
  );
  return ctx;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fitImageToRatio", () => {
  it("crops around the center: a wide image keeps its height", async () => {
    const ctx = stubDrawing([200, 100]);
    expect(await fitImageToRatio("img", "16:9", "crop")).toBe("fitted:178x100");
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), -11, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("crops a tall image by keeping its width", async () => {
    stubDrawing([100, 300]);
    expect(await fitImageToRatio("img", "1:1", "crop")).toBe("fitted:100x100");
  });

  it("pads with black bars, keeping the whole image", async () => {
    const ctx = stubDrawing([90, 90]);
    expect(await fitImageToRatio("img", "16:9", "pad")).toBe("fitted:160x90");
    expect(ctx.fillStyle).toBe("black");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 160, 90);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 35, 0);
  });

  it("pads a wide image by growing its height", async () => {
    stubDrawing([300, 100]);
    expect(await fitImageToRatio("img", "1:1", "pad")).toBe("fitted:300x300");
  });

  it("returns the image unchanged when it already has the ratio, won't load, or can't be read back", async () => {
    stubDrawing([160, 90]);
    expect(await fitImageToRatio("img", "16:9", "crop")).toBe("img");
    vi.restoreAllMocks();
    stubDrawing([200, 100], { loads: false });
    expect(await fitImageToRatio("img", "16:9", "crop")).toBe("img");
    vi.restoreAllMocks();
    stubDrawing([200, 100], { readable: false });
    expect(await fitImageToRatio("img", "16:9", "crop")).toBe("img");
  });

  it("returns the image unchanged with no canvas, or a ratio that isn't w:h", async () => {
    // As in jsdom, a canvas with no 2D context.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(await fitImageToRatio("data:image/png;base64,AA", "16:9", "crop")).toBe("data:image/png;base64,AA");
    expect(await fitImageToRatio("data:image/png;base64,AA", "wide", "pad")).toBe("data:image/png;base64,AA");
  });

  it("fits only images, leaving other media as they are", async () => {
    stubDrawing([200, 100]);
    const clip = { src: "clip", kind: "audio" as const };
    expect(await fitImagesToRatio([clip, { src: "img", kind: "image" }], "16:9", "crop")).toEqual([
      clip,
      { src: "fitted:178x100", kind: "image" },
    ]);
  });
});
