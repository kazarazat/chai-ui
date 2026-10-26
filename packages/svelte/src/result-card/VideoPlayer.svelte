<script lang="ts">
  /**
   * A real `<video>` with slim play/pause and scrubber chrome built on its own
   * playback API, not the browser's heavier native controls. Mounted twice
   * (inline, and in the expand overlay), so `time` and `wasPlaying` carry the
   * position and play state across the swap.
   */
  import Icon from "../Icon.svelte";
  import { PlayIcon } from "../icons.js";

  let {
    src,
    expanded = false,
    time,
    wasPlaying,
    onPlayingChange,
    onDimensions,
  }: {
    src: string;
    expanded?: boolean;
    time: { current: number };
    wasPlaying: boolean;
    onPlayingChange: (playing: boolean) => void;
    onDimensions?: (width: number, height: number) => void;
  } = $props();
  let video = $state<HTMLVideoElement>();
  // svelte-ignore state_referenced_locally
  let playing = $state(wasPlaying);
  let progress = $state(0);

  function togglePlay() {
    const el = video!;
    if (el.paused) el.play();
    else el.pause();
  }

  function onloadedmetadata() {
    const el = video!;
    el.currentTime = time.current;
    if (wasPlaying) el.play().catch(() => {});
    onDimensions?.(el.videoWidth, el.videoHeight);
  }

  function setPlaying(value: boolean) {
    playing = value;
    onPlayingChange(value);
  }

  function ontimeupdate() {
    const el = video!;
    time.current = el.currentTime;
    if (el.duration) progress = el.currentTime / el.duration;
  }

  function scrub(e: MouseEvent) {
    const el = video!;
    if (!el.duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    el.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * el.duration;
  }

  // Keyboard seeking, the slider pattern: arrows move 5s, Home/End jump.
  const STEPS: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
  function onScrubKey(e: KeyboardEvent) {
    const el = video!;
    if (!el.duration) return;
    const step = STEPS[e.key];
    if (step != null) el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + step));
    else if (e.key === "Home") el.currentTime = 0;
    else if (e.key === "End") el.currentTime = el.duration;
    else return;
    e.preventDefault();
  }
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video
  bind:this={video}
  class="chai-result-card__video"
  {src}
  {onloadedmetadata}
  onplay={() => setPlaying(true)}
  onpause={() => setPlaying(false)}
  {ontimeupdate}
></video>
<!-- One control over the whole video: click, or Tab then Space/Enter, to play or pause. The round Play badge is just its paused look. -->
<button type="button" class="chai-result-card__video-toggle" aria-label={playing ? "Pause" : "Play"} onclick={togglePlay}>
  {#if !playing}<span class="chai-result-card__play"><Icon icon={PlayIcon} /></span>{/if}
</button>
<div
  class={["chai-result-card__scrubber", { "chai-result-card__scrubber--expanded": expanded }]}
  role="slider"
  tabindex="0"
  aria-label="Seek"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(progress * 100)}
  aria-valuetext={`${Math.round(progress * 100)}%`}
  onclick={scrub}
  onkeydown={onScrubKey}
>
  <div class="chai-result-card__scrubber-fill" style:width={`${progress * 100}%`}></div>
</div>
