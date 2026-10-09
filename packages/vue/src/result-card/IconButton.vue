<script setup lang="ts">
/** The card's small icon buttons, with the hover circle: in a dark group along the top, in the light pill, or the round button on the right. */
defineProps<{ variant: "top" | "pill" | "round"; label: string; active?: boolean; disabled?: boolean }>();
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
