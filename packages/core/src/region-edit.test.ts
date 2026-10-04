import { describe, expect, it } from "vitest";
import { buildRegionEditPrompt, PRECISE_EDIT_MODELS, type EditRegion } from "./region-edit.js";

const region = (number: number, prompt: string, box = { x: 0.5, y: 0.25, width: 0.25, height: 0.1 }): EditRegion => ({
  id: `r${number}`,
  number,
  box,
  prompt,
});

describe("buildRegionEditPrompt", () => {
  it("returns the prompt as typed when there are no regions", () => {
    expect(buildRegionEditPrompt({ prompt: "  make it night  ", regions: [] })).toBe("make it night");
  });

  it("writes Flux 3 boxes as [top, left, bottom, right] on a 0–1000 grid after the instruction", () => {
    const prompt = buildRegionEditPrompt({
      prompt: "",
      regions: [region(1, "Change Manager to Boss"), region(2, "make the lips green", { x: 0.4, y: 0.2, width: 0.15, height: 0.05 })],
      format: "flux-3-boxes",
    });
    const [record, json] = [prompt.slice(0, prompt.indexOf(" [")), prompt.slice(prompt.indexOf(" [") + 1)];
    expect(record).toBe(
      "In <ref_image_0>, change only the marked regions: <region_1>: Change Manager to Boss; <region_2>: make the lips green. " +
        "Keep everything outside the regions exactly as it is."
    );
    expect(JSON.parse(json)).toEqual([
      { id: "region_1", kind: "anchor", from: "ref_image_0", src_bbox: [250, 500, 350, 750], tgt_bbox: [250, 500, 350, 750], desc: "Change Manager to Boss" },
      { id: "region_2", kind: "anchor", from: "ref_image_0", src_bbox: [200, 400, 250, 550], tgt_bbox: [200, 400, 250, 550], desc: "make the lips green" },
    ]);
  });

  it("adds the whole-image instruction when there is one", () => {
    const prompt = buildRegionEditPrompt({ prompt: "warmer light", regions: [region(1, "remove the logo")], format: "flux-3-boxes" });
    expect(prompt).toContain("Across the whole image: warmer light.");
  });

  it("describes regions in words for a model without box support", () => {
    expect(buildRegionEditPrompt({ prompt: "", regions: [region(3, "remove the logo")] })).toBe(
      "Edit only these areas of the image. Region 3 (from 50% to 75% across and 25% to 35% down): remove the logo. Keep everything else unchanged."
    );
  });

  it("keeps boxes inside the image", () => {
    const prompt = buildRegionEditPrompt({
      prompt: "",
      regions: [region(1, "x", { x: -0.1, y: 0.9, width: 0.3, height: 0.3 })],
      format: "flux-3-boxes",
    });
    expect(prompt).toContain('"tgt_bbox":[900,0,1000,200]');
  });
});

describe("PRECISE_EDIT_MODELS", () => {
  it("suggests Flux 3 Image with box support", () => {
    expect(PRECISE_EDIT_MODELS[0]).toMatchObject({ id: "blackforestlabs/flux-3/edit-image", regionFormat: "flux-3-boxes" });
  });
});
