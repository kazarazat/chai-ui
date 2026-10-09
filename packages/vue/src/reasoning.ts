import { computed, inject, type ComputedRef, type InjectionKey } from "vue";
import type { Reasoning } from "@chai-ui/core";

export const reasoningKey: InjectionKey<ComputedRef<Reasoning>> = Symbol("chai-reasoning");

/** The nearest `ChaiProvider`'s reasoning engine and models; `undefined` outside one. */
export function useReasoning(): ComputedRef<Reasoning | undefined> {
  const provided = inject(reasoningKey, null);
  return computed(() => provided?.value);
}
