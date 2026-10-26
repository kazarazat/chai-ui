<script lang="ts">
  /**
   * Renders a page with its slide. The outgoing image stays in the layout
   * while it slides away, so the card holds its height even while the new
   * image is still loading, and the new page slides in over that space. The
   * page keeps its key once the slide ends, so it isn't remounted (no
   * reloaded image, no restarted video).
   */
  import type { Snippet } from "svelte";
  import type { Slide } from "./page-slide.svelte.js";

  let { slide, pageClass, onEnd, children }: { slide: Slide | null; pageClass?: string; onEnd: () => void; children: Snippet } =
    $props();

  const side = $derived(slide?.forward ? "left" : "right");
  const outgoing = $derived(slide?.active ? slide.from : undefined);
</script>

{#if outgoing}
  {#key slide!.key}
    <img class="chai-slide-out chai-slide-out--{side}" src={outgoing} alt="" aria-hidden="true" draggable="false" />
  {/key}
{/if}
{#key slide?.key ?? 0}
  <div
    class={[pageClass, slide?.active && `chai-slide-in chai-slide-in--${side}`, outgoing && "chai-slide-in--over"]}
    onanimationend={(e) => e.target === e.currentTarget && onEnd()}
  >
    {@render children()}
  </div>
{/key}
