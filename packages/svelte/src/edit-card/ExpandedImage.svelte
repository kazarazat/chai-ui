<script lang="ts">
  /** The full-size image in a modal dialog: focus moves in, Escape closes, and focus returns to what opened it. */
  import { onMount } from "svelte";
  import Icon from "../Icon.svelte";
  import { CloseSymbolIcon } from "../icons.js";

  let { src, alt, onClose }: { src: string; alt: string; onClose: () => void } = $props();
  let closeButton = $state<HTMLButtonElement>();

  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton?.focus();
    return () => opener?.focus();
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // One control inside: keep focus on it.
      e.preventDefault();
      closeButton?.focus();
    }
  }
</script>

<!-- Focus goes to Collapse, the one control inside: the dialog itself needs no tab stop. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="chai-result-card__expand-overlay" role="dialog" aria-modal="true" aria-label="Expanded image" {onkeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="chai-result-card__expand-scrim" role="presentation" onclick={onClose}></div>
  <div class="chai-result-card__expand-frame">
    <img class="chai-result-card__image" {src} {alt} />
    <button bind:this={closeButton} type="button" class="chai-result-card__collapse" aria-label="Collapse" onclick={onClose}>
      <Icon icon={CloseSymbolIcon} />
    </button>
  </div>
</div>
