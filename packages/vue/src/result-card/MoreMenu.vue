<script setup lang="ts">
/** The ⋯ menu of app-specific actions, a positioned popover under its trigger. Closes on a pick, Escape, or a click outside. */
import { onScopeDispose, ref, watch } from "vue";
import { MoreHorizIcon } from "../icons.js";
import IconButton from "./IconButton.vue";
import type { ResultCardMoreAction } from "./types.js";

defineProps<{ actions: ResultCardMoreAction[]; disabled?: boolean }>();
const emit = defineEmits<{ select: [action: ResultCardMoreAction] }>();
const open = ref(false);
const root = ref<HTMLElement>();

function onPointerDown(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}
function listen(on: boolean) {
  if (on) {
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
  } else {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeydown);
  }
}
watch(open, listen);
onScopeDispose(() => listen(false));

function pick(action: ResultCardMoreAction) {
  open.value = false;
  emit("select", action);
}
</script>

<template>
  <div ref="root" class="chai-result-card__more">
    <IconButton variant="pill" label="More" :active="open" :disabled="disabled" @click="open = !open">
      <MoreHorizIcon />
    </IconButton>
    <ul v-if="open" class="chai-result-card__more-menu" role="menu">
      <li v-for="action in actions" :key="action.id" role="none">
        <button type="button" role="menuitem" class="chai-result-card__more-menu-item" @click="pick(action)">
          <span v-if="action.icon" class="chai-result-card__more-menu-icon"><component :is="action.icon" /></span>
          {{ action.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
