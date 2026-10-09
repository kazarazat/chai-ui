<script setup lang="ts">
/**
 * Renders a page with its slide. The outgoing image stays in the layout
 * while it slides away, so the card holds its height even while the new
 * image is still loading, and the new page slides in over that space. The
 * page keeps its key once the slide ends, so it isn't remounted (no
 * reloaded image, no restarted video).
 */
import { computed } from "vue";
import type { Slide } from "./page-slide.js";

const props = defineProps<{ slide: Slide | null; pageClass?: string }>();
const emit = defineEmits<{ end: [] }>();

const side = computed(() => (props.slide?.forward ? "left" : "right"));
const outgoing = computed(() => (props.slide?.active ? props.slide.from : undefined));
</script>

<template>
  <img
    v-if="outgoing"
    :key="`out-${slide!.key}`"
    :class="`chai-slide-out chai-slide-out--${side}`"
    :src="outgoing"
    alt=""
    aria-hidden="true"
    draggable="false"
  />
  <div
    :key="`in-${slide?.key ?? 0}`"
    :class="[pageClass, slide?.active && `chai-slide-in chai-slide-in--${side}`, outgoing && 'chai-slide-in--over']"
    @animationend.self="emit('end')"
  >
    <slot />
  </div>
</template>
