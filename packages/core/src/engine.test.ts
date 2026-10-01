import { describe, expect, it } from "vitest";
import { readEvaluations } from "./engine.js";

describe("readEvaluations", () => {
  it("reads a backend's top-level verdicts", () => {
    expect(readEvaluations({ images: [], evaluations: [{ id: "brand", label: "Brand safe", passed: false }] })).toEqual([
      { id: "brand", label: "Brand safe", passed: false },
    ]);
  });

  it("drops malformed entries instead of rendering verdicts nobody returned", () => {
    expect(
      readEvaluations({
        evaluations: [{ id: "a", label: "A", passed: "yes" }, null, { id: "b", label: "B", passed: true, score: 0.9 }],
      })
    ).toEqual([{ id: "b", label: "B", passed: true }]);
  });

  it("is undefined when there's nothing to read", () => {
    expect(readEvaluations({})).toBeUndefined();
    expect(readEvaluations(null)).toBeUndefined();
    expect(readEvaluations({ evaluations: [] })).toBeUndefined();
  });
});
