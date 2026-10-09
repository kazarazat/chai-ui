/** WCAG 2.2 AA checks with axe, on each component's main states. */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";
import { MEDIA_ANALYSIS_PROMPT_LENGTHS, type MediaAnalysisPromptLength, type ModelOption, type Result } from "@chai-ui/core";
import { Composer, EDIT_IMAGE_USE_CASE } from "../Composer.js";
import { EditCard } from "../EditCard.js";
import { wcagViolations } from "./axe.js";

const model = (id: string, label = id): ModelOption => ({ id, label, provider: "p", speed: "fast" });
const MODELS = [model("fal/fast", "Fast Image"), model("fal/pro", "Pro Image")];
const IMAGE = { kind: "image" as const, label: "Image" };
const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#09f"/></svg>')}`;
const result = (id: string, overrides: Partial<Result> = {}): Result => ({
  id, runId: "run", modelId: "fal/fast", status: "done", output: { src: svg, kind: "image" }, ...overrides,
});

describe("WCAG 2.2 AA (axe)", () => {
  it("EditCard: regions, the open instruction field, zoomed, and an edit in progress", async () => {
    const regions = [
      { id: "r1", number: 1, box: { x: 0.1, y: 0.4, width: 0.3, height: 0.2 }, prompt: "make it green" },
      { id: "r2", number: 2, box: { x: 0.5, y: 0.5, width: 0.3, height: 0.2 }, prompt: "" },
    ];
    const versions = [
      { id: "original", src: svg, status: "done" as const, regions: [] },
      { id: "e1", from: svg, status: "running" as const, regions },
    ];
    const screen = render(
      <EditCard versions={versions} activeVersion={0} onActiveVersionChange={() => {}} regions={regions} onRegionsChange={() => {}} />
    );
    expect(await wcagViolations()).toEqual([]);
    await screen.getByRole("button", { name: /^Region 1/ }).click();
    expect(await wcagViolations()).toEqual([]);
    await screen.getByRole("button", { name: "Zoom in" }).click();
    expect(await wcagViolations()).toEqual([]);
    screen.rerender(
      <EditCard versions={versions} activeVersion={1} onActiveVersionChange={() => {}} regions={[]} onRegionsChange={() => {}} />
    );
    expect(await wcagViolations()).toEqual([]);
  });

});
