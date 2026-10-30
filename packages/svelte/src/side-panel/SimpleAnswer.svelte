<script lang="ts">
  /** An answer as plain text on the side panel, with like, dislike, retry and copy below it. */
  import { sidePanelAnswerText, type Result } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import type { ResultCardVote } from "../result-card/types.js";
  import { CopyIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon } from "../icons.js";

  let {
    result,
    vote,
    canRetry,
    onAction,
  }: {
    result?: Result;
    vote: ResultCardVote;
    canRetry: boolean;
    onAction: (action: "like" | "dislike" | "retry" | "copy") => void;
  } = $props();

  let copied = $state(false);
  const text = $derived(sidePanelAnswerText(result));
  const streaming = $derived(result?.status === "queued" || result?.status === "running");

  function copy() {
    onAction("copy");
    navigator.clipboard?.writeText(text).then(
      () => {
        copied = true;
        setTimeout(() => (copied = false), 1500);
      },
      () => undefined
    );
  }
</script>

{#if result}
  {#if result.status === "error"}
    <div class="chai-side-panel__answer-wrap">
      <p class="chai-side-panel__answer chai-side-panel__answer--error" role="alert">
        {result.error?.message ?? "Something went wrong."}
      </p>
      {#if canRetry}
        <div class="chai-side-panel__answer-actions">
          <button type="button" class="chai-side-panel__answer-btn" aria-label="Retry" title="Retry" onclick={() => onAction("retry")}>
            <Icon icon={RefreshIcon} />
          </button>
        </div>
      {/if}
    </div>
  {:else if result.status === "cancelled"}
    <p class="chai-side-panel__answer chai-side-panel__answer--muted">Stopped</p>
  {:else}
    <div class="chai-side-panel__answer-wrap">
      <!-- Screen readers wait for the finished text instead of announcing every chunk. -->
      <p class={["chai-side-panel__answer", { "chai-side-panel__answer--streaming": streaming }]} aria-busy={streaming}>{text}</p>
      {#if !streaming}
        <div class="chai-side-panel__answer-actions">
          <button
            type="button"
            class={["chai-side-panel__answer-btn", { "chai-side-panel__answer-btn--active": vote === "like" }]}
            aria-label="Like"
            title="Like"
            aria-pressed={vote === "like"}
            onclick={() => onAction("like")}
          >
            <Icon icon={ThumbUpIcon} />
          </button>
          <button
            type="button"
            class={["chai-side-panel__answer-btn", { "chai-side-panel__answer-btn--active": vote === "dislike" }]}
            aria-label="Dislike"
            title="Dislike"
            aria-pressed={vote === "dislike"}
            onclick={() => onAction("dislike")}
          >
            <Icon icon={ThumbDownIcon} />
          </button>
          {#if canRetry}
            <button type="button" class="chai-side-panel__answer-btn" aria-label="Retry" title="Retry" onclick={() => onAction("retry")}>
              <Icon icon={RefreshIcon} />
            </button>
          {/if}
          <button
            type="button"
            class="chai-side-panel__answer-btn"
            aria-label={copied ? "Copied" : "Copy"}
            title={copied ? "Copied" : "Copy"}
            onclick={copy}
          >
            <Icon icon={CopyIcon} />
          </button>
        </div>
      {/if}
    </div>
  {/if}
{/if}
