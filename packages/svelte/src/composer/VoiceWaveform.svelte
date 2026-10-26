<script lang="ts">
  /** What replaces the prompt while recording: recent mic loudness as bars, newest on the right, and the time. Decorative. */
  import { formatVoiceElapsed, VOICE_LEVEL_COUNT } from "@chai-ui/core";

  let { levels, elapsedMs }: { levels: number[]; elapsedMs: number } = $props();
  const bars = $derived([...Array<number>(Math.max(0, VOICE_LEVEL_COUNT - levels.length)).fill(0), ...levels]);
</script>

<div class="chai-composer__waveform" aria-hidden="true">
  <div class="chai-composer__waveform-bars">
    {#each bars as level, i (i)}
      <span class="chai-composer__waveform-bar" style:height={`${Math.max(20, level * 100)}%`}></span>
    {/each}
  </div>
  <span class="chai-composer__waveform-time">{formatVoiceElapsed(elapsedMs)}</span>
</div>
