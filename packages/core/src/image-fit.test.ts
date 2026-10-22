// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fitImageToRatio, fitImagesToRatio } from "./image-fit.js";

describe("fitImageToRatio", () => {
  it("returns the image unchanged where it can't draw, or for a ratio that isn't w:h", async () => {
    // jsdom has no canvas: getContext returns null.
    expect(await fitImageToRatio("data:image/png;base64,AA", "16:9", "crop")).toBe("data:image/png;base64,AA");
    expect(await fitImageToRatio("data:image/png;base64,AA", "wide", "pad")).toBe("data:image/png;base64,AA");
  });

  it("fits only images, leaving other media as they are", async () => {
    const clip = { src: "data:audio/wav;base64,AA", kind: "audio" as const };
    expect(await fitImagesToRatio([clip], "16:9", "crop")).toEqual([clip]);
  });
});
