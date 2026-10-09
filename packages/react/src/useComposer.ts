import { useState, useSyncExternalStore } from "react";
import { createComposerStore, pickReasoning, type ComposerOptions } from "@chai-ui/core";
import { useReasoning } from "./ChaiProvider.js";
import { useLatest } from "./use-latest.js";

export { DEFAULT_MODEL_ID } from "@chai-ui/core";

export type UseComposerOptions = ComposerOptions;

/**
 * The React binding for `createComposerStore` in `@chai-ui/core`: turns a
 * `Composer`'s `onSubmit` payload into a real `Request` → `Run` → `Result`
 * (§6). The behavior lives in core; this keeps its state in React.
 */
export function useComposer(options: UseComposerOptions = {}) {
  const provided = useReasoning();
  // `submit` and friends are stable but read the newest options when they run.
  const latest = useLatest({ options, provided });
  const [store] = useState(() =>
    createComposerStore(
      () => latest.current.options,
      () => latest.current.provided
    )
  );
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // `undefined` (not a no-op function) without reasoning, so a consumer can
  // write `onEnhance={enhance}` directly — matching how `Composer` treats an
  // omitted `onEnhance` as "hide the button".
  const enhance = pickReasoning(options, provided) ? store.enhance : undefined;

  return {
    run: state.runs[0] ?? null,
    runs: state.runs,
    submit: store.submit,
    cancel: store.cancel,
    enhance,
    enhancing: state.enhancing,
    routing: state.routing,
    /** Props for an `EditCard` (spread them in), and `regions` for `Composer`. `null` when there's no `editImage`. */
    edit: store.edit(state, options.editImage),
  };
}

export type UseComposerReturn = ReturnType<typeof useComposer>;
