import { describe, expect, it, vi } from "vitest";
import { createComposerStore, type ComposerOptions, type ComposerSubmitPayload } from "./composer.js";
import type { GenerationEngine } from "./engine.js";
import { buildJudgePrompt, DEFAULT_EVALUATION_CHECKS, parseJudgeReply, type EvaluationCheck } from "./evaluation-judge.js";
import { createReasoning } from "./reasoning.js";

const ON_BRAND: EvaluationCheck = { id: "on-brand", label: "On brand", criterion: "Photographic, never cartoonish.", kind: "image" };

describe("buildJudgePrompt", () => {
  it("frames the prompt, the result and each criterion, asking for JSON verdicts", () => {
    const text = buildJudgePrompt({ prompt: "a haiku about tea", output: { kind: "text", text: "Steam rises slowly" }, checks: DEFAULT_EVALUATION_CHECKS });
    expect(text).toContain('"""\na haiku about tea\n"""');
    expect(text).toContain('The result:\n"""\nSteam rises slowly\n"""');
    expect(text).toContain("- matches-prompt: The result does what the prompt asked for");
    expect(text).toContain("Reply with only a JSON object mapping each id to true (passes) or false (fails)");
    expect(buildJudgePrompt({ prompt: "a shoe", output: { kind: "image" }, checks: [ON_BRAND] })).toContain("The result is the attached image.");
  });
});

describe("parseJudgeReply", () => {
  it("reads each check's verdict, in the checks' order, around any extra words", () => {
    const checks = [ON_BRAND, ...DEFAULT_EVALUATION_CHECKS];
    expect(parseJudgeReply('Here you go: {"matches-prompt": true, "on-brand": false}', checks)).toEqual([
      { id: "on-brand", label: "On brand", passed: false },
      { id: "matches-prompt", label: "Matches prompt", passed: true },
    ]);
  });

  it("skips a check it has no true or false for, and reads nothing from an unreadable reply", () => {
    expect(parseJudgeReply('{"on-brand": "yes", "matches-prompt": false}', [ON_BRAND, ...DEFAULT_EVALUATION_CHECKS])).toEqual([
      { id: "matches-prompt", label: "Matches prompt", passed: false },
    ]);
    expect(parseJudgeReply("Looks great!", [ON_BRAND])).toBeNull();
    expect(parseJudgeReply("{not json}", [ON_BRAND])).toBeNull();
    expect(parseJudgeReply('{"other": true}', [ON_BRAND])).toBeNull();
  });
});

describe("the judge in the Composer store", () => {
  const payload = (kind: "text" | "image" | "video"): ComposerSubmitPayload => {
    const useCase = { kind, label: kind };
    return { value: "a red mug", attachments: [], aspectRatio: null, useCase, modelId: "m", autoSelectModel: false, regions: [], selections: [{ useCase, modelIds: ["m"], models: [] }] };
  };
  const run = (options: ComposerOptions, kind: "text" | "image" | "video", output: Awaited<ReturnType<GenerationEngine["generate"]>>, judge: GenerationEngine["generate"]) => {
    const judgeEngine = vi.fn(judge);
    const engine = { generate: vi.fn(async () => output) };
    const store = createComposerStore(() => ({ engine, textEngine: engine, ...options }), () => createReasoning({}, { generate: judgeEngine }));
    store.submit(payload(kind));
    return { store, judgeEngine };
  };

  it("adds a tag per check after the backend's own evaluations", async () => {
    const backend = { id: "safe", label: "Safe", passed: true };
    const { store, judgeEngine } = run({ judgeModel: "judge" }, "text", { src: "A red mug.", kind: "text", evaluations: [backend] }, async () => ({ src: '{"matches-prompt": true}', kind: "text" }));
    await vi.waitFor(() => expect(store.getState().runs[0]!.results[0]!.evaluations).toHaveLength(2));
    expect(store.getState().runs[0]!.results[0]!.evaluations).toEqual([backend, { id: "matches-prompt", label: "Matches prompt", passed: true }]);
    expect(judgeEngine.mock.calls[0]![0]).toMatchObject({ modelId: "judge", attachments: [] });
    expect(judgeEngine.mock.calls[0]![0].prompt).toContain("A red mug.");
  });

  it("shows the judge an image result, with the builder's checks and prompt", async () => {
    const judgePrompt = vi.fn(() => "custom judge prompt");
    const { store, judgeEngine } = run(
      { judgeModel: "judge", judgeChecks: [ON_BRAND], judgePrompt },
      "image",
      { src: "https://x/mug.png", kind: "image" },
      async () => ({ src: '{"on-brand": false}', kind: "text" })
    );
    await vi.waitFor(() => expect(store.getState().runs[0]!.results[0]!.evaluations).toEqual([{ id: "on-brand", label: "On brand", passed: false }]));
    expect(judgePrompt).toHaveBeenCalledWith({ prompt: "a red mug", output: { kind: "image" }, checks: [ON_BRAND] });
    expect(judgeEngine.mock.calls[0]![0]).toMatchObject({ prompt: "custom judge prompt", attachments: [{ src: "https://x/mug.png", kind: "image" }] });
  });

  it("gives each result only the checks for its kind", async () => {
    const { store, judgeEngine } = run({ judgeModel: "judge", judgeChecks: [ON_BRAND, ...DEFAULT_EVALUATION_CHECKS] }, "text", { src: "A mug.", kind: "text" }, async () => ({ src: '{"matches-prompt": true, "on-brand": false}', kind: "text" }));
    await vi.waitFor(() => expect(store.getState().runs[0]!.results[0]!.evaluations).toEqual([{ id: "matches-prompt", label: "Matches prompt", passed: true }]));
    expect(judgeEngine.mock.calls[0]![0].prompt).not.toContain("on-brand");
  });

  it("doesn't judge without a judgeModel or checks for the kind, or a video", async () => {
    const off = run({}, "image", { src: "https://x/mug.png", kind: "image" }, async () => ({ src: "{}", kind: "text" }));
    const noChecks = run({ judgeModel: "judge", judgeChecks: [{ ...ON_BRAND, kind: "text" }] }, "image", { src: "https://x/mug.png", kind: "image" }, async () => ({ src: "{}", kind: "text" }));
    const video = run({ judgeModel: "judge" }, "video", { src: "https://x/v.mp4", kind: "video" }, async () => ({ src: "{}", kind: "text" }));
    await vi.waitFor(() => expect(video.store.getState().runs[0]!.results[0]!.status).toBe("done"));
    expect(off.judgeEngine).not.toHaveBeenCalled();
    expect(noChecks.judgeEngine).not.toHaveBeenCalled();
    expect(video.judgeEngine).not.toHaveBeenCalled();
  });

  it("warns and adds nothing when the reply is unreadable, the judge fails, or there's no reasoning engine", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unreadable = run({ judgeModel: "judge-a" }, "text", { src: "A mug.", kind: "text" }, async () => ({ src: "Looks great!", kind: "text" }));
    const failing = run({ judgeModel: "judge-b" }, "text", { src: "A mug.", kind: "text" }, async () => {
      throw new Error("rate limited");
    });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining('"judge-a" replied without verdicts'),
      expect.stringContaining('"judge-b" failed, so no evaluations were added: rate limited'),
    ]);
    const engine = { generate: async () => ({ src: "A mug.", kind: "text" as const }) };
    const lone = createComposerStore(() => ({ engine, textEngine: engine, judgeModel: "judge" }), () => undefined);
    lone.submit(payload("text"));
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining("there's no reasoning engine to run it")));
    for (const store of [unreadable.store, failing.store, lone]) expect(store.getState().runs[0]!.results[0]!.evaluations).toBeUndefined();
    warn.mockRestore();
  });
});
