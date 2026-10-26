<script lang="ts">
  /**
   * A text result, streaming or finished. One element for both states, so the
   * scroll position survives the moment a stream completes. Past its max
   * height it scrolls; while streaming it follows the newest text, unless the
   * person has scrolled up to read, in which case it stays where they are.
   */
  import { onMount } from "svelte";

  let { text, streaming }: { text: string; streaming: boolean } = $props();
  let el = $state<HTMLElement>();
  let follow = true;

  function followNewest() {
    if (el && streaming && follow) el.scrollTop = el.scrollHeight;
  }
  // A frame later on mount: set during mount, before the card's first paint,
  // the scroll position doesn't stick in Chromium.
  onMount(() => {
    requestAnimationFrame(followNewest);
  });
  $effect(() => {
    void text;
    void streaming;
    followNewest();
  });

  function onscroll(e: Event) {
    const p = e.currentTarget as HTMLElement;
    follow = p.scrollTop + p.clientHeight >= p.scrollHeight - 24;
  }
</script>

<!-- aria-busy: screen readers wait for the finished text instead of announcing every chunk. tabindex: keyboard users can scroll a long answer. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<p
  bind:this={el}
  class={["chai-result-card__text-output", { "chai-result-card__text-output--streaming": streaming }]}
  aria-busy={streaming}
  tabindex="0"
  {onscroll}
>{text}</p>
