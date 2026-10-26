<script lang="ts">
  /** The ⋯ menu of app-specific actions, a positioned popover under its trigger. Closes on a pick, Escape, or a click outside. */
  import { useDismiss } from "../dismiss.svelte.js";
  import Icon from "../Icon.svelte";
  import { MoreHorizIcon } from "../icons.js";
  import IconButton from "./IconButton.svelte";
  import type { ResultCardMoreAction } from "./types.js";

  let {
    actions,
    disabled = false,
    onSelect,
  }: { actions: ResultCardMoreAction[]; disabled?: boolean; onSelect: (action: ResultCardMoreAction) => void } = $props();
  let open = $state(false);
  let root = $state<HTMLElement>();

  useDismiss(
    () => root,
    () => open,
    () => (open = false)
  );

  function pick(action: ResultCardMoreAction) {
    open = false;
    onSelect(action);
  }
</script>

<div bind:this={root} class="chai-result-card__more">
  <IconButton variant="pill" label="More" active={open} {disabled} onclick={() => (open = !open)}>
    <Icon icon={MoreHorizIcon} />
  </IconButton>
  {#if open}
    <ul class="chai-result-card__more-menu" role="menu">
      {#each actions as action (action.id)}
        <li role="none">
          <button type="button" role="menuitem" class="chai-result-card__more-menu-item" onclick={() => pick(action)}>
            {#if action.icon}<span class="chai-result-card__more-menu-icon"><action.icon /></span>{/if}{action.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
