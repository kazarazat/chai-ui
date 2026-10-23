<script setup lang="ts">
/** The mic: click to record; while recording, a stop button that transcribes; while transcribing, a spinner that cancels. */
import { computed } from "vue";
import type { VoiceInput, VoiceInputState } from "@chai-ui/core";
import { MicIcon, StopIcon } from "../icons.js";

const props = defineProps<{ voice: VoiceInput; state: VoiceInputState; disabled?: boolean; onStart?: () => void }>();

const label = computed(() =>
  props.state.status === "recording"
    ? "Stop recording and transcribe"
    : props.state.status === "transcribing"
      ? "Cancel transcription"
      : "Start voice input"
);

function onClick() {
  const { status } = props.state;
  if (status === "recording") props.voice.stop();
  else if (status === "transcribing") props.voice.cancel();
  else {
    props.voice.dismiss();
    props.onStart?.();
    void props.voice.start();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.state.status === "recording") props.voice.cancel();
}
</script>

<template>
  <div class="chai-composer__voice" :data-status="state.status">
    <button
      type="button"
      class="chai-composer__voice-button"
      :disabled="disabled"
      :aria-label="label"
      :title="label"
      @click="onClick"
      @keydown="onKeydown"
    >
      <span v-if="state.status === 'transcribing'" class="chai-composer__voice-spinner" aria-hidden="true" /><StopIcon
        v-else-if="state.status === 'recording'"
      /><MicIcon v-else />
    </button>
    <!-- Announces each change of state once, not every tick of the timer. -->
    <span class="chai-visually-hidden" role="status">{{ state.status === "recording" ? "Recording" : state.status === "transcribing" ? "Transcribing" : "" }}</span>
  </div>
</template>
