<script setup lang="ts">
import { computed, provide } from "vue";
import { createReasoning, reasoningEngineFor, type GenerationEngine, type MediaKind } from "@chai-ui/core";
import { reasoningKey } from "./reasoning.js";

/** The reasoning engine and models every CHAI component inside shares. Same props as React's `ChaiProvider`. */
const props = defineProps<{
  /** Text, image and routing model. Defaults to `DEFAULT_REASONING_MODEL`. */
  reasoningModel?: string;
  /** Per-attachment-kind models, merged over `DEFAULT_REASONING_MODEL_BY_KIND` one kind at a time. */
  reasoningModelByKind?: Partial<Record<MediaKind, string>>;
  /** The engine the reasoning models run on. Defaults to OpenRouter, independent of the generation engine. */
  reasoningEngine?: GenerationEngine;
}>();

// Created once, and again only when a different engine is passed.
const engine = computed(() => reasoningEngineFor({ reasoningEngine: props.reasoningEngine }));
provide(
  reasoningKey,
  computed(() => createReasoning(props, engine.value))
);
</script>

<template>
  <slot />
</template>
