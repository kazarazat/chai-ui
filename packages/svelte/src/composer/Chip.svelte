<script lang="ts">
  /**
   * A use-case or region chip: its label, and a remove button revealed on
   * hover when it can be removed. A region chip shows its numbered badge in
   * the region's color, matching the box on the image.
   */
  import type { Snippet } from "svelte";
  import { regionColor } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import { CloseSymbolIcon } from "../icons.js";

  let {
    label,
    regionNumber,
    icon,
    context = false,
    removable = false,
    disabled = false,
    onRemove,
  }: {
    label: string;
    regionNumber?: number;
    icon?: Snippet;
    /** A context chip, e.g. a side panel's "This page". */
    context?: boolean;
    removable?: boolean;
    disabled?: boolean;
    onRemove: () => void;
  } = $props();
</script>

<!-- Label and button touch: whitespace between them would render as a space. -->
<span
  class={["chai-composer__chip", { "chai-composer__chip--region": regionNumber != null, "chai-composer__chip--context": context }]}
  style:--chai-region-color={regionNumber != null ? regionColor(regionNumber) : undefined}
  >{#if regionNumber != null}<span class="chai-composer__region-badge" aria-hidden="true">{regionNumber}</span>{/if}{#if icon}<span
      class="chai-composer__chip-icon">{@render icon()}</span
    >{/if}{label}{#if removable}<button
      type="button"
      class="chai-composer__chip-remove"
      {disabled}
      aria-label={`Remove ${label}`}
      onclick={onRemove}><Icon icon={CloseSymbolIcon} /></button
    >{/if}</span
>
