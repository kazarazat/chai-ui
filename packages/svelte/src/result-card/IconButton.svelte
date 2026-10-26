<script lang="ts">
  /** The card's small icon buttons, with the hover circle: in a dark group along the top, in the light pill, or the round button on the right. */
  import type { Snippet } from "svelte";

  let {
    variant,
    label,
    active,
    disabled = false,
    onclick,
    children,
  }: {
    variant: "top" | "pill" | "round";
    label: string;
    active?: boolean;
    disabled?: boolean;
    onclick: () => void;
    children: Snippet;
  } = $props();
  const CLASS = { top: "chai-card-top-btn", pill: "chai-card-pill-btn", round: "chai-card-round" } as const;
</script>

<button
  type="button"
  class={[CLASS[variant], { "chai-card-pill-btn--active": active }]}
  aria-label={label}
  aria-pressed={active}
  title={label}
  {disabled}
  {onclick}
>
  {@render children()}
</button>
