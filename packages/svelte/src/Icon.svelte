<script lang="ts">
  import type { IconData } from "./icons.js";

  /** One of the inline SVG icons in `icons.ts`, drawn in `currentColor` and hidden from screen readers. */
  let { icon }: { icon: IconData } = $props();
</script>

<svg viewBox={icon.viewBox} aria-hidden="true" fill={icon.traced ? "none" : undefined}>
  {#each icon.shapes as { tag = "path", ...attrs }, i (i)}
    <svelte:element this={tag} {...attrs} />
  {/each}
</svg>
