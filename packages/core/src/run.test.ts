import { describe, expect, it } from "vitest";
import {
  createRun,
  deriveGenerationUseCase,
  failResult,
  resolveResult,
  startResult,
  streamResult,
  type Request,
} from "./run.js";

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return { prompt: "a red mug", attachments: [], modelIds: ["model-a", "model-b"], params: {}, ...overrides };
}

describe("createRun", () => {
  it("fans out one queued result per model, all up front", () => {
    const run = createRun(fakeRequest());
    expect(run.results).toHaveLength(2);
    expect(run.results.every((r) => r.status === "queued")).toBe(true);
    expect(run.results.map((r) => r.modelId)).toEqual(["model-a", "model-b"]);
  });

  it("stamps every result with the run's own id", () => {
    const run = createRun(fakeRequest());
    expect(run.results.every((r) => r.runId === run.id)).toBe(true);
  });

  it("gives every run and result a distinct id", () => {
    const a = createRun(fakeRequest());
    const b = createRun(fakeRequest());
    expect(a.id).not.toBe(b.id);
    expect(a.results[0]!.id).not.toBe(a.results[1]!.id);
  });
});

describe("startResult / resolveResult / failResult", () => {
  it("moves one result through queued -> running -> done without touching its siblings", () => {
    const run = createRun(fakeRequest());
    const [first, second] = run.results;

    const running = startResult(run, first!.id);
    expect(running.results.find((r) => r.id === first!.id)!.status).toBe("running");
    expect(running.results.find((r) => r.id === second!.id)!.status).toBe("queued");

    const done = resolveResult(running, first!.id, { src: "https://x/img.png", kind: "image" });
    expect(done.results.find((r) => r.id === first!.id)).toMatchObject({
      status: "done",
      output: { src: "https://x/img.png", kind: "image" },
    });
    expect(done.results.find((r) => r.id === second!.id)!.status).toBe("queued");
  });

  it("carries usage through to a resolved result when given", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const done = resolveResult(
      run,
      run.results[0]!.id,
      { src: "https://x/img.png", kind: "image" },
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    );
    expect(done.results[0]!.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("carries the backend's evaluation verdicts through to a resolved result", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const evaluations = [{ id: "brand", label: "Brand safe", passed: false }];
    const done = resolveResult(run, run.results[0]!.id, { src: "https://x/img.png", kind: "image" }, undefined, evaluations);
    expect(done.results[0]!.evaluations).toEqual(evaluations);
  });

  it("fails one result with a message + reasons, leaving the run's other data alone", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const failed = failResult(run, run.results[0]!.id, { message: "Nope", reasons: ["bad input"] });
    expect(failed.results[0]).toMatchObject({ status: "error", error: { message: "Nope", reasons: ["bad input"] } });
    expect(failed.id).toBe(run.id);
    expect(failed.request).toBe(run.request);
  });

  it("never mutates the run passed in — every transition returns a new object", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const before = JSON.stringify(run);
    startResult(run, run.results[0]!.id);
    expect(JSON.stringify(run)).toBe(before);
  });
});

describe("streamResult", () => {
  it("fills in partial text while the result stays running", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const id = run.results[0]!.id;
    const streaming = streamResult(startResult(run, id), id, "a red");
    expect(streaming.results[0]).toMatchObject({ status: "running", output: { src: "a red", kind: "text" } });
  });

  it("is a no-op once the result has settled, so a late chunk can't overwrite the final output", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    const id = run.results[0]!.id;
    const done = resolveResult(startResult(run, id), id, { src: "a red mug", kind: "text" });
    expect(streamResult(done, id, "a red").results[0]!.output).toEqual({ src: "a red mug", kind: "text" });
  });

  it("ignores a result that hasn't started yet", () => {
    const run = createRun(fakeRequest({ modelIds: ["model-a"] }));
    expect(streamResult(run, run.results[0]!.id, "early").results[0]!.output).toBeUndefined();
  });
});

describe("deriveGenerationUseCase", () => {
  it("returns undefined when no use case is set", () => {
    expect(deriveGenerationUseCase(null, [])).toBeUndefined();
  });

  it("maps video + no attachments to text-to-video", () => {
    expect(deriveGenerationUseCase({ kind: "video" }, [])).toBe("text-to-video");
  });

  it("maps video + an attachment to image-to-video", () => {
    expect(deriveGenerationUseCase({ kind: "video" }, [{ src: "x", kind: "image" }])).toBe(
      "image-to-video"
    );
  });

  it("maps image + no attachments to text-to-image, and image + an attachment to image-edit", () => {
    expect(deriveGenerationUseCase({ kind: "image" }, [])).toBe("text-to-image");
    expect(deriveGenerationUseCase({ kind: "image" }, [{ src: "x", kind: "image" }])).toBe("image-edit");
  });

  it("maps text + no attachments to text-to-text, and text + an attachment to vision", () => {
    expect(deriveGenerationUseCase({ kind: "text" }, [])).toBe("text-to-text");
    expect(deriveGenerationUseCase({ kind: "text" }, [{ src: "x", kind: "image" }])).toBe("vision");
  });

  it("returns undefined for audio — no GenerationUseCase member exists yet", () => {
    expect(deriveGenerationUseCase({ kind: "audio" }, [])).toBeUndefined();
  });
});
