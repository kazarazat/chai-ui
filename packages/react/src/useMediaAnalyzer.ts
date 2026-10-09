import { useState, useSyncExternalStore } from "react";
import { createMediaAnalyzerStore, type MediaAnalyzerOptions } from "@chai-ui/core";
import { useReasoning } from "./ChaiProvider.js";
import { useLatest } from "./use-latest.js";

export type UseMediaAnalyzerOptions = MediaAnalyzerOptions;

/**
 * The React binding for `createMediaAnalyzerStore` in `@chai-ui/core`, behind
 * `MediaAnalyzer`'s `onSubmit`: returns the generated prompt, which fills in
 * as the text streams.
 */
export function useMediaAnalyzer(options: UseMediaAnalyzerOptions = {}) {
  const provided = useReasoning();
  const latest = useLatest({ options, provided });
  const [store] = useState(() =>
    createMediaAnalyzerStore(
      () => latest.current.options,
      () => latest.current.provided
    )
  );
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { ...state, submit: store.submit, cancel: store.cancel, reset: store.reset };
}

export type UseMediaAnalyzerReturn = ReturnType<typeof useMediaAnalyzer>;
