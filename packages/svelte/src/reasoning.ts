import { getContext, setContext } from "svelte";
import type { Reasoning } from "@chai-ui/core";

const reasoningKey = Symbol("chai-reasoning");

/** Shares a `ChaiProvider`'s reasoning with every Chai component inside it. */
export function provideReasoning(get: () => Reasoning) {
  setContext(reasoningKey, get);
}

/**
 * The nearest `ChaiProvider`'s reasoning engine and models; `current` is
 * `undefined` outside one. Call it while a component initializes.
 */
export function useReasoning(): { readonly current: Reasoning | undefined } {
  const get = getContext<(() => Reasoning) | undefined>(reasoningKey);
  return {
    get current() {
      return get?.();
    },
  };
}
