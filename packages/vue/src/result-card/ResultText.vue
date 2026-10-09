<script setup lang="ts">
/**
 * A text result, streaming or finished. One element for both states, so the
 * scroll position survives the moment a stream completes. Past its max
 * height it scrolls; while streaming it follows the newest text, unless the
 * person has scrolled up to read, in which case it stays where they are.
 */
import { onMounted, ref, watch } from "vue";

const props = defineProps<{ text: string; streaming: boolean }>();
const el = ref<HTMLElement>();
let follow = true;

function followNewest() {
  if (el.value && props.streaming && follow) el.value.scrollTop = el.value.scrollHeight;
}
// A frame later on mount: set during mount, before the card's first paint,
// the scroll position didn't stick in Chromium (React's effect runs after paint).
onMounted(() => requestAnimationFrame(followNewest));
watch(() => [props.text, props.streaming], followNewest, { flush: "post" });

function onScroll(e: Event) {
  const p = e.currentTarget as HTMLElement;
  follow = p.scrollTop + p.clientHeight >= p.scrollHeight - 24;
}
</script>

<template>
  <!-- aria-busy: screen readers wait for the finished text instead of announcing every chunk. tabindex: keyboard users can scroll a long answer. -->
  <p
    ref="el"
    :class="['chai-result-card__text-output', { 'chai-result-card__text-output--streaming': streaming }]"
    :aria-busy="streaming"
    tabindex="0"
    @scroll="onScroll"
  >{{ text }}</p>
</template>
