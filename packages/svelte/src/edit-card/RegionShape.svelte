<script lang="ts">
  /** One region on the image: a button to select, move or delete it, its number badge, and corner handles while selected. */
  import { REGION_CORNERS, regionBoxStyle, type EditRegion, type RegionCorner } from "@chai-ui/core";
  import { styleString } from "../style.js";

  let {
    region,
    selected,
    draft,
    disabled,
    onDragStart,
    onSelect,
    onKeydown,
  }: {
    region: EditRegion;
    selected: boolean;
    draft: boolean;
    disabled: boolean;
    onDragStart: (e: PointerEvent, kind: "move" | RegionCorner) => void;
    onSelect: () => void;
    onKeydown: (e: KeyboardEvent) => void;
  } = $props();
</script>

<div
  class={["chai-edit-card__region", { "chai-edit-card__region--selected": selected, "chai-edit-card__region--draft": draft }]}
  style={styleString(regionBoxStyle(region))}
>
  <button
    type="button"
    class="chai-edit-card__region-body"
    aria-label={`Region ${region.number}${region.prompt ? `: ${region.prompt}` : ", no instruction yet"}. Arrow keys move it, Shift and arrow keys resize it.`}
    aria-pressed={selected}
    {disabled}
    onpointerdown={(e) => onDragStart(e, "move")}
    onclick={onSelect}
    onkeydown={onKeydown}
  ></button>
  <span class="chai-edit-card__badge" aria-hidden="true">{region.number}</span>
  {#if selected}
    {#each REGION_CORNERS as corner (corner)}
      <span
        class="chai-edit-card__handle chai-edit-card__handle--{corner}"
        aria-hidden="true"
        onpointerdown={(e) => onDragStart(e, corner)}
      ></span>
    {/each}
  {/if}
</div>
