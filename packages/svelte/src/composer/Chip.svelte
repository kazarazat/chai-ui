<script lang="ts">
  /**
   * A use-case or region chip: its label, and a remove button revealed on
   * hover when it can be removed. A region chip shows its numbered badge in
   * the region's color, matching the box on the image.
   */
  import { regionColor } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import { CloseSymbolIcon } from "../icons.js";

  let {
    label,
    regionNumber,
    removable = false,
    disabled = false,
    onRemove,
  }: { label: string; regionNumber?: number; removable?: boolean; disabled?: boolean; onRemove: () => void } = $props();
</script>

<!-- Label and button touch: whitespace between them would render as a space. -->
<span
  class={["chai-composer__chip", { "chai-composer__chip--region": regionNumber != null }]}
  style:--chai-region-color={regionNumber != null ? regionColor(regionNumber) : undefined}
  >{#if regionNumber != null}<span class="chai-composer__region-badge" aria-hidden="true">{regionNumber}</span>{/if}{label}{#if removable}<button
      type="button"
      class="chai-composer__chip-remove"
      {disabled}
      aria-label={`Remove ${label}`}
      onclick={onRemove}><Icon icon={CloseSymbolIcon} /></button
    >{/if}</span
>
