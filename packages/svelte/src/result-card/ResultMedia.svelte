<script lang="ts">
  /** The card's front: the result's image, video, audio or text, or its pending, stopped or failed state, with Download, Share and Expand over it. */
  import type { Result } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import { CheckSymbolIcon, DownloadIcon, ExpandIcon, ShareIcon } from "../icons.js";
  import IconButton from "./IconButton.svelte";
  import ResultText from "./ResultText.svelte";
  import VideoPlayer from "./VideoPlayer.svelte";

  let {
    result,
    alt,
    disabled = false,
    mediaExpanded,
    linkCopied,
    videoTime,
    videoWasPlaying,
    onDownload,
    onShare,
    onExpand,
    onDimensions,
    onVideoPlayingChange,
  }: {
    result: Result;
    alt: string;
    disabled?: boolean;
    mediaExpanded: boolean;
    linkCopied: boolean;
    videoTime: { current: number };
    videoWasPlaying: boolean;
    onDownload: () => void;
    onShare: () => void;
    onExpand: () => void;
    onDimensions: (width: number, height: number) => void;
    onVideoPlayingChange: (playing: boolean) => void;
  } = $props();

  const kind = $derived(result.output?.kind);
  // "Running with output" is a text result streaming in: show the partial text, not the spinner.
  const streaming = $derived(result.status === "running" && kind === "text");
  const pending = $derived((result.status === "queued" || result.status === "running") && !streaming);

  function onload(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    onDimensions(img.naturalWidth, img.naturalHeight);
  }
</script>

{#if pending}
  <div class="chai-result-card__media chai-result-card__media--pending">
    <span class="chai-result-card__spinner" role="img" aria-label={result.status === "running" ? "Running" : "Queued"}></span>
  </div>
{:else if result.status === "cancelled" && !result.output}
  <!-- Stopped before any output. A stopped stream keeps its partial text and renders below like any other. -->
  <div class="chai-result-card__media chai-result-card__media--cancelled">
    <p class="chai-result-card__cancelled-text">Stopped</p>
  </div>
{:else if result.status === "error"}
  <div class="chai-result-card__media chai-result-card__media--error">
    <p class="chai-result-card__error-text">{result.error?.message ?? "Something went wrong."}</p>
  </div>
{:else if !result.output}
  <div class="chai-result-card__media"></div>
{:else}
  <div class={["chai-result-card__media", { "chai-result-card__media--fixed-height": kind === "audio" || kind === "text" }]}>
    {#if kind === "video"}
      <!-- While expanded, the playing video is in the overlay; a still frame holds the layout here. -->
      {#if mediaExpanded}
        <img class="chai-result-card__image" src={result.output.src} alt="" />
      {:else}
        <VideoPlayer
          src={result.output.src}
          time={videoTime}
          wasPlaying={videoWasPlaying}
          onPlayingChange={onVideoPlayingChange}
          {onDimensions}
        />
      {/if}
    {:else if kind === "audio"}
      <audio class="chai-result-card__audio" src={result.output.src} controls></audio>
    {:else if kind === "text"}
      <ResultText text={result.output.src} {streaming} />
    {:else}
      <img class="chai-result-card__image" src={result.output.src} {alt} {onload} />
    {/if}

    {#if !mediaExpanded && !streaming}
      <div class="chai-card-top chai-card-top--end">
        <IconButton variant="top" label="Download" {disabled} onclick={onDownload}><Icon icon={DownloadIcon} /></IconButton>
        <IconButton variant="top" label={linkCopied ? "Link copied" : "Share"} {disabled} onclick={onShare}>
          <Icon icon={linkCopied ? CheckSymbolIcon : ShareIcon} />
        </IconButton>
        {#if kind === "video" || kind === "image"}
          <IconButton variant="top" label="Expand" {disabled} onclick={onExpand}><Icon icon={ExpandIcon} /></IconButton>
        {/if}
      </div>
    {/if}
  </div>
{/if}
