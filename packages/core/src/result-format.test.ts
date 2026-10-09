import { describe, expect, it } from "vitest";
import { formatAspectRatio, formatCost, formatDuration, formatTokens, resultModelLabel } from "./result-format.js";
import type { Result } from "./run.js";

describe("result formatting", () => {
  it("formats duration, cost and tokens, and nothing when missing", () => {
    expect(formatDuration(3030)).toBe("3.03s");
    expect(formatCost(0.0042)).toBe("$0.00");
    expect(formatTokens(1000)).toMatch(/^1.?000 tokens$/);
    expect([formatDuration(undefined), formatCost(undefined), formatTokens(undefined)]).toEqual([undefined, undefined, undefined]);
  });

  it("reduces measured dimensions to an exact ratio", () => {
    expect(formatAspectRatio(1920, 1080)).toBe("16:9");
    expect(formatAspectRatio(1000, 333)).toBe("1000:333");
    expect(formatAspectRatio(0, 10)).toBeUndefined();
  });

  it("labels a result's model, its id when unlisted, and a routing placeholder", () => {
    const result = (modelId: string) => ({ id: "r", runId: "x", modelId, status: "done" }) as Result;
    const models = [{ id: "fal/fast", label: "Fast", provider: "fal", speed: "fast" as const }];
    expect(resultModelLabel(result("fal/fast"), models)).toBe("Fast");
    expect(resultModelLabel(result("other/model"), models)).toBe("other/model");
    expect(resultModelLabel(result("routing"))).toBe("Choosing model…");
  });
});
