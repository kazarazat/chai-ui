<script setup lang="ts">
/** An answer as plain text on the side panel, with like, dislike, retry and copy below it. */
import { computed, ref } from "vue";
import { sidePanelAnswerText, type Result } from "@chai-ui/core";
import type { ResultCardVote } from "../result-card/types.js";
import { CopyIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon } from "../icons.js";

const props = defineProps<{ result?: Result; vote: ResultCardVote; canRetry: boolean }>();
const emit = defineEmits<{ action: [action: "like" | "dislike" | "retry" | "copy"] }>();

const copied = ref(false);
const text = computed(() => sidePanelAnswerText(props.result));
const streaming = computed(() => props.result?.status === "queued" || props.result?.status === "running");

function copy() {
  emit("action", "copy");
  navigator.clipboard?.writeText(text.value).then(
    () => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 1500);
    },
    () => undefined
  );
}
</script>

<template>
  <template v-if="result">
    <div v-if="result.status === 'error'" class="chai-side-panel__answer-wrap">
      <p class="chai-side-panel__answer chai-side-panel__answer--error" role="alert">
        {{ result.error?.message ?? "Something went wrong." }}
      </p>
      <div v-if="canRetry" class="chai-side-panel__answer-actions">
        <button type="button" class="chai-side-panel__answer-btn" aria-label="Retry" title="Retry" @click="emit('action', 'retry')">
          <RefreshIcon />
        </button>
      </div>
    </div>
    <p v-else-if="result.status === 'cancelled'" class="chai-side-panel__answer chai-side-panel__answer--muted">Stopped</p>
    <div v-else class="chai-side-panel__answer-wrap">
      <!-- Screen readers wait for the finished text instead of announcing every chunk. -->
      <p :class="['chai-side-panel__answer', { 'chai-side-panel__answer--streaming': streaming }]" :aria-busy="streaming">{{ text }}</p>
      <div v-if="!streaming" class="chai-side-panel__answer-actions">
        <button
          type="button"
          :class="['chai-side-panel__answer-btn', { 'chai-side-panel__answer-btn--active': vote === 'like' }]"
          aria-label="Like"
          title="Like"
          :aria-pressed="vote === 'like'"
          @click="emit('action', 'like')"
        >
          <ThumbUpIcon />
        </button>
        <button
          type="button"
          :class="['chai-side-panel__answer-btn', { 'chai-side-panel__answer-btn--active': vote === 'dislike' }]"
          aria-label="Dislike"
          title="Dislike"
          :aria-pressed="vote === 'dislike'"
          @click="emit('action', 'dislike')"
        >
          <ThumbDownIcon />
        </button>
        <button v-if="canRetry" type="button" class="chai-side-panel__answer-btn" aria-label="Retry" title="Retry" @click="emit('action', 'retry')">
          <RefreshIcon />
        </button>
        <button type="button" class="chai-side-panel__answer-btn" :aria-label="copied ? 'Copied' : 'Copy'" :title="copied ? 'Copied' : 'Copy'" @click="copy">
          <CopyIcon />
        </button>
      </div>
    </div>
  </template>
</template>
