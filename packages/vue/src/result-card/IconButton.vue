<script setup lang="ts">
/** The card's small icon buttons, with the hover circle: in a dark group along the top, in the light pill, or the round button on the right. */
withDefaults(defineProps<{ variant: "top" | "pill" | "round"; label: string; active?: boolean; disabled?: boolean }>(), {
  // Left undefined unless set: Vue would make an absent boolean `false`, and
  // `aria-pressed="false"` makes a plain button read as a toggle that's off.
  active: undefined,
});
const CLASS = { top: "chai-card-top-btn", pill: "chai-card-pill-btn", round: "chai-card-round" } as const;
</script>

<template>
  <button
    type="button"
    :class="[CLASS[variant], { 'chai-card-pill-btn--active': active }]"
    :aria-label="label"
    :aria-pressed="active"
    :title="label"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
