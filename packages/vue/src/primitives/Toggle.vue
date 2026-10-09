<script setup lang="ts">
/** MD3 `<md-switch>`, colored from Chai tokens by `chai-switch` in style.css. Use with `v-model`. */
import "@material/web/switch/switch.js";

defineProps<{
  modelValue: boolean;
  disabled?: boolean;
  /** The switch's accessible name, e.g. "Auto-select model". Required unless something else labels it. */
  ariaLabel?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <md-switch
    class="chai-switch"
    :aria-label="ariaLabel"
    :selected.prop="modelValue"
    :disabled.prop="disabled ?? false"
    show-only-selected-icon
    @change="emit('update:modelValue', ($event.target as HTMLInputElement & { selected: boolean }).selected)"
  />
</template>
