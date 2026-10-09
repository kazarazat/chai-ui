import { computed, onScopeDispose, shallowRef, toValue, type MaybeRefOrGetter } from "vue";
import { createComposerStore, pickReasoning, type ComposerOptions } from "@chai-ui/core";
import { useReasoning } from "./reasoning.js";

export type UseComposerOptions = ComposerOptions;

/**
 * The Vue binding for `createComposerStore` in `@chai-ui/core`: turns a
 * `Composer`'s submit payload into a real `Request` → `Run` → `Result`.
 * Pass a getter (or ref) for options that change, e.g. `() => ({ engine, editImage: image.value })`.
 */
export function useComposer(options: MaybeRefOrGetter<UseComposerOptions> = {}) {
  const provided = useReasoning();
  const store = createComposerStore(
    () => toValue(options),
    () => provided.value
  );
  const state = shallowRef(store.getState());
  onScopeDispose(
    store.subscribe(() => (state.value = store.getState())),
    true
  );

  return {
    run: computed(() => state.value.runs[0] ?? null),
    runs: computed(() => state.value.runs),
    submit: store.submit,
    cancel: store.cancel,
    /** `undefined` without reasoning, so the Composer hides its Enhance button. */
    enhance: computed(() => (pickReasoning(toValue(options), provided.value) ? store.enhance : undefined)),
    enhancing: computed(() => state.value.enhancing),
    routing: computed(() => state.value.routing),
    /** Props for an `EditCard`, and `regions` for `Composer`. `null` when there's no `editImage`. */
    edit: computed(() => store.edit(state.value, toValue(options).editImage)),
  };
}

export type UseComposerReturn = ReturnType<typeof useComposer>;
