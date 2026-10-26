<script lang="ts">
  /** The mic: click to record; while recording, a stop button that transcribes; while transcribing, a spinner that cancels. */
  import type { VoiceInput, VoiceInputState } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import { MicIcon, StopIcon } from "../icons.js";

  let {
    voice,
    state,
    disabled = false,
    onStart,
  }: { voice: VoiceInput; state: VoiceInputState; disabled?: boolean; onStart?: () => void } = $props();

  const label = $derived(
    state.status === "recording"
      ? "Stop recording and transcribe"
      : state.status === "transcribing"
        ? "Cancel transcription"
        : "Start voice input"
  );

  function onclick() {
    const { status } = state;
    if (status === "recording") voice.stop();
    else if (status === "transcribing") voice.cancel();
    else {
      voice.dismiss();
      onStart?.();
      void voice.start();
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && state.status === "recording") voice.cancel();
  }
</script>

<div class="chai-composer__voice" data-status={state.status}>
  <button type="button" class="chai-composer__voice-button" {disabled} aria-label={label} title={label} {onclick} {onkeydown}>
    {#if state.status === "transcribing"}
      <span class="chai-composer__voice-spinner" aria-hidden="true"></span>
    {:else}
      <Icon icon={state.status === "recording" ? StopIcon : MicIcon} />
    {/if}
  </button>
  <!-- Announces each change of state once, not every tick of the timer. -->
  <span class="chai-visually-hidden" role="status"
    >{state.status === "recording" ? "Recording" : state.status === "transcribing" ? "Transcribing" : ""}</span
  >
</div>
