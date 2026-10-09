<script setup lang="ts">
/** The ⋯ menu of app-specific actions, a positioned popover under its trigger. Closes on a pick, Escape, or a click outside. */
import { ref } from "vue";
import { useDismiss } from "../dismiss.js";
import { MoreHorizIcon } from "../icons.js";
import IconButton from "./IconButton.vue";
import type { ResultCardMoreAction } from "./types.js";

defineProps<{ actions: ResultCardMoreAction[]; disabled?: boolean }>();
const emit = defineEmits<{ select: [action: ResultCardMoreAction] }>();
const open = ref(false);
const root = ref<HTMLElement>();

useDismiss(root, open, () => (open.value = false));

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
          <span v-if="action.icon" class="chai-result-card__more-menu-icon"><component :is="action.icon" /></span>{{ action.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
