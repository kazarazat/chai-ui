<script setup lang="ts">
/** The card's front: the result's image, video, audio or text, or its pending, stopped or failed state, with Download, Share and Expand over it. */
import { computed } from "vue";
import type { Result } from "@chai-ui/core";
import { CheckSymbolIcon, DownloadIcon, ExpandIcon, ShareIcon } from "../icons.js";
import IconButton from "./IconButton.vue";
import ResultText from "./ResultText.vue";
import VideoPlayer from "./VideoPlayer.vue";

const props = defineProps<{
  result: Result;
  alt: string;
  disabled?: boolean;
  mediaExpanded: boolean;
  linkCopied: boolean;
  videoTime: { current: number };
  videoWasPlaying: boolean;
}>();
const emit = defineEmits<{
  download: [];
  share: [];
  expand: [];
  dimensions: [width: number, height: number];
  videoPlayingChange: [playing: boolean];
}>();

const kind = computed(() => props.result.output?.kind);
// "Running with output" is a text result streaming in: show the partial text, not the spinner.
const streaming = computed(() => props.result.status === "running" && kind.value === "text");
const pending = computed(() => (props.result.status === "queued" || props.result.status === "running") && !streaming.value);

function onImageLoad(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  emit("dimensions", img.naturalWidth, img.naturalHeight);
}
</script>

<template>
  <div v-if="pending" class="chai-result-card__media chai-result-card__media--pending">
    <span class="chai-result-card__spinner" role="img" :aria-label="result.status === 'running' ? 'Running' : 'Queued'" />
  </div>
  <!-- Stopped before any output. A stopped stream keeps its partial text and renders below like any other. -->
  <div v-else-if="result.status === 'cancelled' && !result.output" class="chai-result-card__media chai-result-card__media--cancelled">
    <p class="chai-result-card__cancelled-text">Stopped</p>
  </div>
  <div v-else-if="result.status === 'error'" class="chai-result-card__media chai-result-card__media--error">
    <p class="chai-result-card__error-text">{{ result.error?.message ?? "Something went wrong." }}</p>
  </div>
  <div v-else-if="!result.output" class="chai-result-card__media" />
  <div v-else :class="['chai-result-card__media', { 'chai-result-card__media--fixed-height': kind === 'audio' || kind === 'text' }]">
    <template v-if="kind === 'video'">
      <!-- While expanded, the playing video is in the overlay; a still frame holds the layout here. -->
      <img v-if="mediaExpanded" class="chai-result-card__image" :src="result.output.src" alt="" />
      <VideoPlayer
        v-else
        :src="result.output.src"
        :time="videoTime"
        :was-playing="videoWasPlaying"
        @playing-change="emit('videoPlayingChange', $event)"
        @dimensions="(w, h) => emit('dimensions', w, h)"
      />
    </template>
    <audio v-else-if="kind === 'audio'" class="chai-result-card__audio" :src="result.output.src" controls />
    <ResultText v-else-if="kind === 'text'" :text="result.output.src" :streaming="streaming" />
    <img v-else class="chai-result-card__image" :src="result.output.src" :alt="alt" @load="onImageLoad" />

    <div v-if="!mediaExpanded && !streaming" class="chai-card-top chai-card-top--end">
      <IconButton variant="top" label="Download" :disabled="disabled" @click="emit('download')"><DownloadIcon /></IconButton>
      <IconButton variant="top" :label="linkCopied ? 'Link copied' : 'Share'" :disabled="disabled" @click="emit('share')">
        <CheckSymbolIcon v-if="linkCopied" /><ShareIcon v-else />
      </IconButton>
      <IconButton v-if="kind === 'video' || kind === 'image'" variant="top" label="Expand" :disabled="disabled" @click="emit('expand')">
        <ExpandIcon />
      </IconButton>
    </div>
  </div>
</template>
