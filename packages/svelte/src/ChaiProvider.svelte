<script lang="ts">
  import type { Snippet } from "svelte";
  import { createReasoning, reasoningEngineFor, type ReasoningConfig } from "@chai-ui/core";
  import { provideReasoning } from "./reasoning.js";

  /** The reasoning engine and models every Chai component inside shares. Same props as React's `ChaiProvider`. */
  let { reasoningModel, reasoningModelByKind, reasoningEngine, children }: ReasoningConfig & { children?: Snippet } =
    $props();

  // Created once, and again only when a different engine is passed.
  const engine = $derived(reasoningEngineFor({ reasoningEngine }));
  const reasoning = $derived(createReasoning({ reasoningModel, reasoningModelByKind }, engine));
  provideReasoning(() => reasoning);
</script>

{@render children?.()}
