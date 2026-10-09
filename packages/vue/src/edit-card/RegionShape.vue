<script setup lang="ts">
/** One region on the image: a button to select, move or delete it, its number badge, and corner handles while selected. */
import { REGION_CORNERS, regionBoxStyle, type EditRegion, type RegionCorner } from "@chai-ui/core";

defineProps<{ region: EditRegion; selected: boolean; draft: boolean; disabled: boolean }>();
const emit = defineEmits<{
  dragStart: [e: PointerEvent, kind: "move" | RegionCorner];
  select: [];
  keydown: [e: KeyboardEvent];
}>();
</script>

<template>
  <div
    :class="['chai-edit-card__region', { 'chai-edit-card__region--selected': selected, 'chai-edit-card__region--draft': draft }]"
    :style="regionBoxStyle(region)"
  >
    <button
      type="button"
      class="chai-edit-card__region-body"
      :aria-label="`Region ${region.number}${region.prompt ? `: ${region.prompt}` : ', no instruction yet'}. Arrow keys move it, Shift and arrow keys resize it.`"
      :aria-pressed="selected"
      :disabled="disabled"
      @pointerdown="emit('dragStart', $event, 'move')"
      @click="emit('select')"
      @keydown="emit('keydown', $event)"
    />
    <span class="chai-edit-card__badge" aria-hidden="true">{{ region.number }}</span>
    <template v-if="selected">
      <span
        v-for="corner in REGION_CORNERS"
        :key="corner"
        :class="`chai-edit-card__handle chai-edit-card__handle--${corner}`"
        aria-hidden="true"
        @pointerdown="emit('dragStart', $event, corner)"
      />
    </template>
  </div>
</template>
