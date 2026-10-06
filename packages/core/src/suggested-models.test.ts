import { describe, expect, it } from "vitest";
import {
  SUGGESTED_ANALYSIS_MODELS,
  SUGGESTED_EDIT_MODELS,
  SUGGESTED_FAL_MODELS,
  SUGGESTED_IMAGE_TO_VIDEO_MODELS,
  suggestedModels,
} from "./suggested-models.js";
import { buildFalRequestBody } from "./engines/fal.js";

const image = { src: "https://x/a.png", kind: "image" as const };

describe("suggested models", () => {
  it("lists models for each generation use case, and none for text", () => {
    for (const useCase of ["text-to-image", "text-to-video", "image-to-video", "image-edit"] as const) {
      expect(suggestedModels(useCase).length).toBeGreaterThan(0);
    }
    expect(suggestedModels("text-to-text")).toEqual([]);
    expect(suggestedModels(undefined)).toEqual([]);
  });

  it("uses short labels, real ratios and says how each Fal model takes its inputs", () => {
    const all = [...SUGGESTED_FAL_MODELS.values(), ...Object.values(SUGGESTED_ANALYSIS_MODELS).flat()];
    for (const m of all) {
      expect(m.label).not.toMatch(/[()]/);
      expect(m.aspectRatios ?? []).not.toContain("auto");
    }
    for (const m of SUGGESTED_FAL_MODELS.values()) expect(m.falInput).toBeDefined();
  });

  it("keeps image-to-video and edits to the image's own shape", () => {
    for (const m of [...SUGGESTED_IMAGE_TO_VIDEO_MODELS, ...SUGGESTED_EDIT_MODELS]) expect(m.aspectRatios).toBeUndefined();
  });
});

describe("buildFalRequestBody with suggested models", () => {
  it("sends Kling its image as start_image_url", () => {
    expect(buildFalRequestBody({ prompt: "p", attachments: [image], model: "fal-ai/kling-video/v3/pro/image-to-video" })).toEqual({
      prompt: "p",
      start_image_url: image.src,
    });
  });

  it("sends edit models every image as image_urls", () => {
    expect(buildFalRequestBody({ prompt: "p", attachments: [image], model: "fal-ai/nano-banana-pro/edit" })).toEqual({
      prompt: "p",
      image_urls: [image.src],
    });
  });

  it("sends GPT Image 2 a named image_size", () => {
    expect(buildFalRequestBody({ prompt: "p", model: "openai/gpt-image-2", aspectRatio: "16:9" })).toEqual({
      prompt: "p",
      image_size: "landscape_16_9",
    });
  });
});
