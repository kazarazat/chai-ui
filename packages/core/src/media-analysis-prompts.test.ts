import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH,
  MEDIA_ANALYSIS_PROMPT_LENGTHS,
  MEDIA_ANALYSIS_PROMPTS,
} from "./media-analysis-prompts.js";

describe("MEDIA_ANALYSIS_PROMPTS", () => {
  it("has a finished instruction for every kind and length", () => {
    for (const kind of ["image", "video", "audio"] as const) {
      for (const { value } of MEDIA_ANALYSIS_PROMPT_LENGTHS) {
        const prompt = MEDIA_ANALYSIS_PROMPTS[kind][value];
        expect(prompt).toContain(`attached ${kind}`);
        expect(prompt).toContain(value);
        // Every prompt asks for the description alone, in the target model's style.
        expect(prompt).toMatch(/Respond only with the description, no preamble\.$/);
        expect(prompt).toContain("known prompt style");
      }
    }
  });

  it("offers the three lengths, defaulting to concise", () => {
    expect(MEDIA_ANALYSIS_PROMPT_LENGTHS.map((l) => l.value)).toEqual(["terse", "concise", "detailed"]);
    expect(DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH).toBe("concise");
  });
});
