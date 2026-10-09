import { computed, onScopeDispose, shallowRef, toValue, type MaybeRefOrGetter } from "vue";
import { createMediaAnalyzerStore, type MediaAnalyzerOptions } from "@chai-ui/core";
import { useReasoning } from "./reasoning.js";

export type UseMediaAnalyzerOptions = MediaAnalyzerOptions;

/**
 * The Vue binding for `createMediaAnalyzerStore` in `@chai-ui/core`, behind
 * `MediaAnalyzer`'s submit: `prompt` fills in as the text streams.
 */
export function useMediaAnalyzer(options: MaybeRefOrGetter<UseMediaAnalyzerOptions> = {}) {
  const provided = useReasoning();
  const store = createMediaAnalyzerStore(
    () => toValue(options),
    () => provided.value
  );
  const state = shallowRef(store.getState());
  onScopeDispose(
    store.subscribe(() => (state.value = store.getState())),
    true
  );

  return {
    analyzing: computed(() => state.value.analyzing),
    error: computed(() => state.value.error),
    prompt: computed(() => state.value.prompt),
    submit: store.submit,
    cancel: store.cancel,
    reset: store.reset,
  };
}

export type UseMediaAnalyzerReturn = ReturnType<typeof useMediaAnalyzer>;
