<script lang="ts">
  /** MD3 `<md-switch>`, colored from Chai tokens by `chai-switch` in style.css. */
  import "@material/web/switch/switch.js";
  import type { PrimitiveProps } from "@chai-ui/core";

  let {
    value,
    onChange,
    disabled = false,
    ariaLabel,
  }: PrimitiveProps<boolean> & {
    /** The switch's accessible name, e.g. "Auto-select model". Required unless something else labels it. */
    ariaLabel?: string;
  } = $props();
</script>

<md-switch
  class="chai-switch"
  aria-label={ariaLabel}
  selected={value}
  {disabled}
  show-only-selected-icon
  onchange={(e: Event) => onChange((e.target as HTMLElement & { selected: boolean }).selected)}
></md-switch>
