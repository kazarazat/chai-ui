<script setup lang="ts">
/**
 * A use-case or region chip: its label, and a remove button revealed on
 * hover when it can be removed. A region chip shows its numbered badge in
 * the region's color, matching the box on the image.
 */
import type { Component } from "vue";
import { regionColor } from "@chai-ui/core";
import { CloseSymbolIcon } from "../icons.js";

defineProps<{ label: string; regionNumber?: number; icon?: Component; context?: boolean; removable?: boolean; disabled?: boolean }>();
const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <span
    :class="['chai-composer__chip', { 'chai-composer__chip--region': regionNumber != null, 'chai-composer__chip--context': context }]"
    :style="regionNumber != null ? { '--chai-region-color': regionColor(regionNumber) } : undefined"
  >
    <!-- Label and button touch: whitespace between them would render as a space. -->
    <span v-if="regionNumber != null" class="chai-composer__region-badge" aria-hidden="true">{{ regionNumber }}</span
    ><span v-if="icon" class="chai-composer__chip-icon"><component :is="icon" /></span
    >{{ label }}<button
      v-if="removable" type="button" class="chai-composer__chip-remove" :disabled="disabled" :aria-label="`Remove ${label}`" @click="emit('remove')">
      <CloseSymbolIcon />
    </button>
  </span>
</template>
