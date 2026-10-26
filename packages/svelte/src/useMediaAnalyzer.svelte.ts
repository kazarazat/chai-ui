import { onDestroy } from "svelte";
import { createMediaAnalyzerStore, type MediaAnalyzerOptions } from "@chai-ui/core";
import { useReasoning } from "./reasoning.js";

export type UseMediaAnalyzerOptions = MediaAnalyzerOptions;

/**
 * The Svelte binding for `createMediaAnalyzerStore` in `@chai-ui/core`, behind
 * `MediaAnalyzer`'s `onSubmit`: `prompt` fills in as the text streams.
 * Read the fields from the returned object: destructuring them stops the updates.
 */
export function useMediaAnalyzer(options: UseMediaAnalyzerOptions | (() => UseMediaAnalyzerOptions) = {}) {
  const read = typeof options === "function" ? options : () => options;
  const provided = useReasoning();
  const store = createMediaAnalyzerStore(read, () => provided.current);
  let state = $state.raw(store.getState());
  onDestroy(store.subscribe(() => (state = store.getState())));

  return {
    get analyzing() {
      return state.analyzing;
    },
    get error() {
      return state.error;
    },
    get prompt() {
      return state.prompt;
    },
    submit: store.submit,
    cancel: store.cancel,
    reset: store.reset,
  };
}

export type UseMediaAnalyzerReturn = ReturnType<typeof useMediaAnalyzer>;
