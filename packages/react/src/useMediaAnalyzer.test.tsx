// The behavior lives in `@chai-ui/core` (media-analyzer.test.ts). This
// covers what the React binding adds: state that re-renders, and the provider.
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GenerationEngine } from "@chai-ui/core";
import { ChaiProvider, DEFAULT_REASONING_MODEL } from "./ChaiProvider.js";
import { useMediaAnalyzer } from "./useMediaAnalyzer.js";

describe("useMediaAnalyzer", () => {
  it("analyzes with the provider's reasoning model, re-rendering as the prompt arrives, and reset clears it", async () => {
    const generate = vi.fn().mockResolvedValue({ src: "A red mug on oak.", kind: "text" });
    const engine: GenerationEngine = { generate };
    const { result } = renderHook(() => useMediaAnalyzer(), {
      wrapper: ({ children }: { children: ReactNode }) => <ChaiProvider reasoningEngine={engine}>{children}</ChaiProvider>,
    });

    act(() =>
      result.current.submit({
        attachments: [{ id: "a", kind: "image", src: "https://x/a.png" }],
        modelId: null,
        autoSelectModel: false,
        models: [],
        promptLength: null,
      })
    );
    expect(result.current.analyzing).toBe(true);
    await waitFor(() => expect(result.current.prompt).toBe("A red mug on oak."));
    expect(result.current.analyzing).toBe(false);
    expect(generate.mock.calls[0]![0].modelId).toBe(DEFAULT_REASONING_MODEL);

    act(() => result.current.reset());
    expect(result.current.prompt).toBeNull();
  });
});
