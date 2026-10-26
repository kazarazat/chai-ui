<script lang="ts">
  /**
   * The Composer bar's complement, and the last stop in the pipeline: the
   * results from one prompt, one at a time, paged with the dots when there
   * are several. Flips to show the prompt and details. Same props as React's
   * `ResultCard`.
   */
  import { tick, untrack } from "svelte";
  import {
    downloadFilename,
    downloadMedia,
    formatAspectRatio,
    formatCost,
    formatDuration,
    formatTokens,
    resultCardEvents,
    resultModelLabel,
    shareMedia,
    type ChaiEvent,
    type ModelOption,
    type Result,
  } from "@chai-ui/core";
  import Icon from "./Icon.svelte";
  import { CheckIcon, CloseIcon, CopyIcon, InfoIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon } from "./icons.js";
  import PageSlide from "./PageSlide.svelte";
  import { usePageSlide } from "./page-slide.svelte.js";
  import Pagination from "./primitives/Pagination.svelte";
  import IconButton from "./result-card/IconButton.svelte";
  import MoreMenu from "./result-card/MoreMenu.svelte";
  import ResultMedia from "./result-card/ResultMedia.svelte";
  import VideoPlayer from "./result-card/VideoPlayer.svelte";
  import type { ResultCardMoreAction, ResultCardVote } from "./result-card/types.js";

  let {
    results,
    width,
    textMaxHeight,
    prompt,
    altText,
    models,
    getVote,
    onAction,
    moreActions,
    disabled = false,
    onEvent,
  }: {
    /** The results from one prompt: `results[0]` if there's only one, paged internally if more. */
    results: Result[];
    /** Fixed width in px. Defaults to 375; height follows the media. */
    width?: number;
    /** Max height in px of a text result before it scrolls. Defaults to 400. */
    textMaxHeight?: number;
    /** The request's prompt, shown read-only (copiable) on the info side. */
    prompt: string;
    /** Alt text for a generated image. Defaults to `prompt`. */
    altText?: (result: Result) => string;
    /** Resolves `Result.modelId` to a label, on the info side and beside the page dots. */
    models?: ModelOption[];
    /** A result's vote, if any. Controlled: what a vote means is the app's policy. */
    getVote?: (result: Result) => ResultCardVote;
    /** `"like"`, `"dislike"`, `"download"`, `"share"`, `"copy-prompt"`, `"retry"`, or a `moreActions` id, with the result it's for. */
    onAction: (action: string, result: Result) => void;
    /** Extra items in the ⋯ menu. Omit to hide the menu. */
    moreActions?: ResultCardMoreAction[];
    disabled?: boolean;
    /** Front-end analytics: a result appearing, result actions, paging and opening the details side, one `ChaiEvent` each. */
    onEvent?: (event: ChaiEvent) => void;
  } = $props();

  let activeIndex = $state(0);
  let flipped = $state(false);
  let copied = $state(false);
  let linkCopied = $state(false);
  let mediaExpanded = $state(false);
  // Measured off the loaded media for the aspect-ratio chip, with the id it
  // was measured from, so a stale ratio never shows after paging.
  let measured = $state<{ id: string; width: number; height: number } | null>(null);
  const videoTime = { current: 0 };
  let videoWasPlaying = $state(false);
  let front = $state<HTMLElement>();
  let back = $state<HTMLElement>();
  let overlay = $state<HTMLElement>();

  const index = $derived(Math.min(activeIndex, Math.max(0, results.length - 1)));
  const result = $derived(results[index]);
  const kind = $derived(result?.output?.kind);
  const paginated = $derived(results.length > 1);
  // An image or video runs under a dark fade into the bar; text, audio and status pages keep the plain surface.
  const overMedia = $derived(kind === "image" || kind === "video");
  const vote = $derived((result && getVote?.(result)) ?? null);
  const modelLabel = $derived(result ? resultModelLabel(result, models) : "");
  const alt = $derived(result ? (altText?.(result) ?? prompt) : "");
  const chips = $derived.by(() => {
    const dims = measured?.id === result?.id ? measured : null;
    return [
      modelLabel,
      formatTokens(result?.usage?.totalTokens),
      formatCost(result?.usage?.costUsd),
      formatDuration(result?.durationMs),
      dims ? formatAspectRatio(dims.width, dims.height) : undefined,
    ].filter(Boolean) as string[];
  });

  // Paging slides, with the last image sliding out (other kinds just slide in).
  const pageSlide = usePageSlide(() => ({
    id: result?.id,
    index,
    image: kind === "image" ? result!.output!.src : undefined,
  }));

  /** A result action: reported, then sent with the result it's for. */
  function report(action: string, r: Result) {
    onEvent?.(resultCardEvents.action(action));
    onAction(action, r);
  }
  const act = (action: string) => report(action, result!);

  /** Paging to another result, reported. */
  function goTo(next: number) {
    if (next !== index) onEvent?.(resultCardEvents.paged(next, results.length));
    activeIndex = next;
  }

  function openInfo() {
    onEvent?.(resultCardEvents.infoOpened());
    flipped = true;
  }

  // Each result reports once, the first time it's shown done or failed.
  const shownIds = new Set<string>();
  $effect.pre(() => {
    for (const r of results) {
      if ((r.status === "done" || r.status === "error") && !shownIds.has(r.id)) {
        shownIds.add(r.id);
        const { status, output } = r;
        untrack(() => onEvent?.(resultCardEvents.shown(status, output?.kind, results.length)));
      }
    }
  });

  function flash(set: (on: boolean) => void) {
    set(true);
    setTimeout(() => set(false), 1500);
  }

  function copyPrompt() {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    flash((on) => (copied = on));
    act("copy-prompt");
  }

  async function download() {
    const r = result!;
    if (r.output) await downloadMedia(r.output.src, downloadFilename(r.id, r.output.kind, r.output.src));
    report("download", r);
  }

  async function share() {
    const r = result!;
    // With no share sheet the link is copied; say so, or the click looks like nothing happened.
    if (r.output && (await shareMedia(r.output.src)) === "copied") flash((on) => (linkCopied = on));
    report("share", r);
  }

  // Flipping moves focus to the side now showing, so a keyboard user isn't
  // left on a button that just turned away. Not on the first render.
  let wasFlipped = false;
  $effect(() => {
    if (flipped === wasFlipped) return;
    wasFlipped = flipped;
    const target = flipped
      ? back?.querySelector<HTMLElement>('[aria-label="Close details"]')
      : front?.querySelector<HTMLElement>('[aria-label="Show details"]');
    target?.focus();
  });

  // The expanded view is a modal dialog: focus moves in, Tab stays inside,
  // Escape closes, and focus returns to Expand, the only way in.
  let wasExpanded = false;
  $effect(() => {
    if (mediaExpanded === wasExpanded) return;
    wasExpanded = mediaExpanded;
    const open = mediaExpanded;
    void tick().then(() => {
      if (open) overlay?.querySelector<HTMLElement>(".chai-result-card__collapse")?.focus();
      else front?.querySelector<HTMLElement>('[aria-label="Expand"]')?.focus();
    });
  });

  function onOverlayKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      mediaExpanded = false;
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [
      ...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, [tabindex="0"], a[href], input, video[controls]'),
    ].filter((el) => !el.hasAttribute("disabled"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

{#if result}
  <div
    class={["chai-result-card", { "chai-result-card--flipped": flipped }]}
    style:--chai-result-card-width={width != null ? `${width}px` : undefined}
    style:--chai-result-card-text-max-height={textMaxHeight != null ? `${textMaxHeight}px` : undefined}
  >
    <div class="chai-result-card__inner">
      <!-- The face turned away is inert, so its buttons can't be tabbed to. -->
      <div
        bind:this={front}
        class={["chai-result-card__face chai-result-card__front", { "chai-result-card__front--paginated": paginated }]}
        aria-hidden={flipped}
        inert={flipped}
      >
        <div class="chai-result-card__media-frame">
          <PageSlide slide={pageSlide.slide} pageClass="chai-result-card__media-page" onEnd={pageSlide.endSlide}>
            <ResultMedia
              {result}
              {alt}
              {disabled}
              {mediaExpanded}
              {linkCopied}
              {videoTime}
              {videoWasPlaying}
              onDownload={download}
              onShare={share}
              onExpand={() => (mediaExpanded = true)}
              onDimensions={(w, h) => (measured = { id: result.id, width: w, height: h })}
              onVideoPlayingChange={(playing) => (videoWasPlaying = playing)}
            />
          </PageSlide>
          {#if paginated && overMedia}<div class="chai-card-fade"></div>{/if}
        </div>

        <!-- With several results, the page dots are the card's last row, with the model that made this page on the left. -->
        {#if paginated}
          <div class={["chai-card-pager-bar", { "chai-card-pager-bar--over-media": overMedia }]}>
            <span class="chai-card-pager-label">{modelLabel}</span>
            <Pagination count={results.length} {index} label="Results" {disabled} onChange={goTo} />
          </div>
        {/if}

        <!-- Floating over the bottom of the media: votes and retry in one pill, details on the right. -->
        <div class="chai-card-bottom">
          <div class="chai-card-actions">
            <div class="chai-card-pill">
              <IconButton variant="pill" label="Like" active={vote === "like"} {disabled} onclick={() => act("like")}>
                <Icon icon={ThumbUpIcon} />
              </IconButton>
              <IconButton variant="pill" label="Dislike" active={vote === "dislike"} {disabled} onclick={() => act("dislike")}>
                <Icon icon={ThumbDownIcon} />
              </IconButton>
              <IconButton variant="pill" label="Retry" {disabled} onclick={() => act("retry")}><Icon icon={RefreshIcon} /></IconButton>
              {#if moreActions?.length}
                <MoreMenu actions={moreActions} {disabled} onSelect={(action) => act(action.id)} />
              {/if}
            </div>
            <IconButton variant="round" label="Show details" {disabled} onclick={openInfo}><Icon icon={InfoIcon} /></IconButton>
          </div>
        </div>
      </div>

      <div bind:this={back} class="chai-result-card__face chai-result-card__back" aria-hidden={!flipped} inert={!flipped}>
        <button type="button" class="chai-result-card__close" aria-label="Close details" onclick={() => (flipped = false)}>
          <Icon icon={CloseIcon} />
        </button>
        <div class="chai-result-card__prompt-box">
          <p class="chai-result-card__prompt-text">{prompt}</p>
          <button
            type="button"
            class="chai-result-card__copy"
            aria-label={copied ? "Copied" : "Copy prompt"}
            title={copied ? "Copied" : "Copy prompt"}
            onclick={copyPrompt}
          >
            <Icon icon={copied ? CheckIcon : CopyIcon} />
          </button>
        </div>
        <div class="chai-result-card__chips">
          {#each chips as chip, i (i)}
            <span class="chai-result-card__chip">{chip}</span>
          {/each}
          <!-- The builder's own backend checks: pass green with a check, fail red with a cross, so the verdict never relies on color alone. -->
          {#each result.evaluations ?? [] as evaluation (evaluation.id)}
            <span
              class="chai-result-card__chip chai-result-card__chip--evaluation chai-result-card__chip--{evaluation.passed ? 'passed' : 'failed'}"
              title={`${evaluation.label}: ${evaluation.passed ? "passed" : "failed"}`}
            >
              <Icon icon={evaluation.passed ? CheckIcon : CloseIcon} />{evaluation.label}<span class="chai-visually-hidden"
                >{evaluation.passed ? ", passed" : ", failed"}</span
              >
            </span>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- The expanded view is the card's sibling, not its child: the card's
       `perspective` (for the flip) would make a nested `position: fixed`
       overlay cover only the card. The expanded video is a second element;
       `videoTime` and `videoWasPlaying` carry its place across. -->
  {#if mediaExpanded && result.output && overMedia}
    <!-- Focus goes to Collapse when it opens, as in React and Vue: the dialog itself needs no tab stop. -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      bind:this={overlay}
      class="chai-result-card__expand-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={kind === "video" ? "Expanded video" : "Expanded image"}
      onkeydown={onOverlayKeydown}
    >
      <div class="chai-result-card__expand-scrim" role="presentation" onclick={() => (mediaExpanded = false)}></div>
      <div class="chai-result-card__expand-frame">
        {#if kind === "video"}
          <VideoPlayer
            src={result.output.src}
            expanded
            time={videoTime}
            wasPlaying={videoWasPlaying}
            onPlayingChange={(playing) => (videoWasPlaying = playing)}
          />
        {:else}
          <img class="chai-result-card__image" src={result.output.src} {alt} />
        {/if}
        <button type="button" class="chai-result-card__collapse" aria-label="Collapse" onclick={() => (mediaExpanded = false)}>
          <Icon icon={CloseIcon} />
        </button>
      </div>
    </div>
  {/if}
{/if}
