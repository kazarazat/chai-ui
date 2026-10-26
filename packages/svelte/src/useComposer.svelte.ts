import { onDestroy } from "svelte";
import { createComposerStore, pickReasoning, type ComposerOptions } from "@chai-ui/core";
import { useReasoning } from "./reasoning.js";

export type UseComposerOptions = ComposerOptions;

/**
 * The Svelte binding for `createComposerStore` in `@chai-ui/core`: turns a
 * `Composer`'s `onSubmit` payload into a real `Request` → `Run` → `Result`.
 * Pass a function for options that change, e.g. `() => ({ engine, editImage })`.
 * Read the fields from the returned object (`composer.run`): destructuring
 * them stops the updates.
 */
export function useComposer(options: UseComposerOptions | (() => UseComposerOptions) = {}) {
  const read = typeof options === "function" ? options : () => options;
  const provided = useReasoning();
  const store = createComposerStore(read, () => provided.current);
  let state = $state.raw(store.getState());
  onDestroy(store.subscribe(() => (state = store.getState())));

  // `undefined` (not a no-op function) without reasoning, so the Composer hides its Enhance button.
  const enhance = $derived(pickReasoning(read(), provided.current) ? store.enhance : undefined);
  const edit = $derived(store.edit(state, read().editImage));

  return {
    get run() {
      return state.runs[0] ?? null;
    },
    get runs() {
      return state.runs;
    },
    submit: store.submit,
    cancel: store.cancel,
    get enhance() {
      return enhance;
    },
    get enhancing() {
      return state.enhancing;
    },
    get routing() {
      return state.routing;
    },
    /** Props for an `EditCard`, and `regions` for `Composer`. `null` when there's no `editImage`. */
    get edit() {
      return edit;
    },
  };
}

export type UseComposerReturn = ReturnType<typeof useComposer>;
