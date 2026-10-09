<script setup lang="ts">
/**
 * A real `<video>` with slim play/pause and scrubber chrome built on its own
 * playback API, not the browser's heavier native controls. Mounted twice
 * (inline, and in the expand overlay), so `time` and `wasPlaying` carry the
 * position and play state across the swap.
 */
import { ref } from "vue";
import { PlayIcon } from "../icons.js";

const props = defineProps<{ src: string; expanded?: boolean; time: { current: number }; wasPlaying: boolean }>();
const emit = defineEmits<{ playingChange: [playing: boolean]; dimensions: [width: number, height: number] }>();
const video = ref<HTMLVideoElement>();
const playing = ref(props.wasPlaying);
const progress = ref(0);

function togglePlay() {
  const el = video.value!;
  if (el.paused) el.play();
  else el.pause();
}

function onLoadedMetadata() {
  const el = video.value!;
  el.currentTime = props.time.current;
  if (props.wasPlaying) el.play().catch(() => {});
  emit("dimensions", el.videoWidth, el.videoHeight);
}

function setPlaying(value: boolean) {
  playing.value = value;
  emit("playingChange", value);
}

function onTimeUpdate() {
  const el = video.value!;
  props.time.current = el.currentTime;
  if (el.duration) progress.value = el.currentTime / el.duration;
}

function scrub(e: MouseEvent) {
  const el = video.value!;
  if (!el.duration) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  el.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * el.duration;
}

// Keyboard seeking, the slider pattern: arrows move 5s, Home/End jump.
const STEPS: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
function onScrubKey(e: KeyboardEvent) {
  const el = video.value!;
  if (!el.duration) return;
  const step = STEPS[e.key];
  if (step != null) el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + step));
  else if (e.key === "Home") el.currentTime = 0;
  else if (e.key === "End") el.currentTime = el.duration;
  else return;
  e.preventDefault();
}
</script>

<template>
  <video
    ref="video"
    class="chai-result-card__video"
    :src="src"
    @loadedmetadata="onLoadedMetadata"
    @play="setPlaying(true)"
    @pause="setPlaying(false)"
    @timeupdate="onTimeUpdate"
  />
  <!-- One control over the whole video: click, or Tab then Space/Enter, to play or pause. The round Play badge is just its paused look. -->
  <button type="button" class="chai-result-card__video-toggle" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay">
    <span v-if="!playing" class="chai-result-card__play"><PlayIcon /></span>
  </button>
  <div
    :class="['chai-result-card__scrubber', { 'chai-result-card__scrubber--expanded': expanded }]"
    role="slider"
    tabindex="0"
    aria-label="Seek"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="Math.round(progress * 100)"
    :aria-valuetext="`${Math.round(progress * 100)}%`"
    @click="scrub"
    @keydown="onScrubKey"
  >
    <div class="chai-result-card__scrubber-fill" :style="{ width: `${progress * 100}%` }" />
  </div>
</template>
