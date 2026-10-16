<script setup lang="ts">
/** What replaces the prompt while recording: recent mic loudness as bars, newest on the right, and the time. Decorative. */
import { computed } from "vue";
import { formatVoiceElapsed, VOICE_LEVEL_COUNT } from "@chai-ui/core";

const props = defineProps<{ levels: number[]; elapsedMs: number }>();
const bars = computed(() => [...Array<number>(Math.max(0, VOICE_LEVEL_COUNT - props.levels.length)).fill(0), ...props.levels]);
</script>

<template>
  <div class="chai-composer__waveform" aria-hidden="true">
    <div class="chai-composer__waveform-bars">
      <span v-for="(level, i) in bars" :key="i" class="chai-composer__waveform-bar" :style="{ height: `${Math.max(20, level * 100)}%` }" />
    </div>
    <span class="chai-composer__waveform-time">{{ formatVoiceElapsed(elapsedMs) }}</span>
  </div>
</template>
