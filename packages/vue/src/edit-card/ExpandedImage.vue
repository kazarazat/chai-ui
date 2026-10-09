<script setup lang="ts">
/** The full-size image in a modal dialog: focus moves in, Escape closes, and focus returns to what opened it. */
import { onMounted, onUnmounted, ref } from "vue";
import { CloseSymbolIcon } from "../icons.js";

defineProps<{ src: string; alt: string }>();
const emit = defineEmits<{ close: [] }>();
const closeButton = ref<HTMLButtonElement>();
let opener: HTMLElement | null = null;

onMounted(() => {
  opener = document.activeElement as HTMLElement | null;
  closeButton.value?.focus();
});
onUnmounted(() => opener?.focus());

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    emit("close");
  } else if (e.key === "Tab") {
    // One control inside: keep focus on it.
    e.preventDefault();
    closeButton.value?.focus();
  }
}
</script>

<template>
  <div class="chai-result-card__expand-overlay" role="dialog" aria-modal="true" aria-label="Expanded image" @keydown="onKeydown">
    <div class="chai-result-card__expand-scrim" role="presentation" @click="emit('close')" />
    <div class="chai-result-card__expand-frame">
      <img class="chai-result-card__image" :src="src" :alt="alt" />
      <button ref="closeButton" type="button" class="chai-result-card__collapse" aria-label="Collapse" @click="emit('close')">
        <CloseSymbolIcon />
      </button>
    </div>
  </div>
</template>
