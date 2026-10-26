<script setup lang="ts">
/**
 * One prompt textarea with its Enhance button: grows with wrapped text,
 * reveals a rewrite as it lands, and offers undo until the text is edited by
 * hand. A `heading` gives it a visible label above a filled box (a world's
 * Environment and Character); without one it's the bar's plain prompt.
 */
import { computed, onScopeDispose, ref, useId, watch } from "vue";
import { enhanceRevealDurationMs, MAX_ANIMATE_ENHANCE_LENGTH } from "@chai-ui/core";
import { OptimizeIcon, UndoIcon } from "../icons.js";

const props = defineProps<{
  value: string;
  placeholder: string;
  /** Accessible name for the plain prompt. Defaults to `placeholder`. */
  label?: string;
  heading?: string;
  note?: string;
  /** Shown under a headed field, e.g. why submit can't go yet. */
  hint?: string | null;
  onEnhance?: (value: string) => void;
  /** After an Enhance, the button's "Revert to original" click. */
  onRevert?: () => void;
  /** The field took focus: voice input fills the field the person was last in. */
  onFocus?: () => void;
  enhancing: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ change: [value: string] }>();
const id = useId();

// Grows with wrapped text from one line, instead of a fixed row count.
const textarea = ref<HTMLTextAreaElement>();
watch(
  () => props.value,
  () => {
    const el = textarea.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  },
  { flush: "post", immediate: true }
);

// Enhance and undo. The prompt already holds the rewrite once `enhancing`
// drops; the reveal is a decorative overlay painting it in, then gone.
const originalValue = ref<string | null>(null);
const enhancedValue = ref<string | null>(null);
const animatingText = ref<string | null>(null);
const revealedLength = ref(0);
let raf = 0;

watch(
  () => props.enhancing,
  (now, was) => {
    if (!was || now || originalValue.value == null || props.value === originalValue.value) return;
    const value = props.value;
    enhancedValue.value = value;
    // Long rewrites and reduced-motion requests appear at once.
    if (value.length > MAX_ANIMATE_ENHANCE_LENGTH || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    animatingText.value = value;
    revealedLength.value = 0;
    const duration = enhanceRevealDurationMs(value.length);
    const start = performance.now();
    const tick = (time: number) => {
      revealedLength.value = Math.min(value.length, Math.floor(((time - start) / duration) * value.length));
      if (revealedLength.value < value.length) raf = requestAnimationFrame(tick);
      else animatingText.value = null;
    };
    raf = requestAnimationFrame(tick);
  }
);
onScopeDispose(() => cancelAnimationFrame(raf));

const animating = computed(() => animatingText.value != null);
const isEnhanced = computed(() => !animating.value && enhancedValue.value != null && props.value === enhancedValue.value);
const enhanceBusy = computed(() => props.enhancing || animating.value);
const optimizeName = computed(
  () => `${isEnhanced.value ? "Revert to original" : "Optimize"} ${props.heading ? props.heading.toLowerCase() : "prompt"}`
);

function onOptimizeClick() {
  if (isEnhanced.value) {
    const original = originalValue.value;
    enhancedValue.value = null;
    originalValue.value = null;
    if (original != null) emit("change", original);
    props.onRevert?.();
    return;
  }
  originalValue.value = props.value; // for undo, before the rewrite lands
  props.onEnhance?.(props.value);
}
</script>

<template>
  <!-- A world's labeled field: heading and Enhance above a filled box. -->
  <div v-if="heading" class="chai-composer__world-field">
    <div class="chai-composer__world-field-head">
      <label :for="id" class="chai-composer__world-field-label"><strong>{{ heading }}</strong> {{ note }}</label>
      <!-- Optimize, or once a rewrite lands, undo it: until the text is edited by hand. -->
      <button
        v-if="onEnhance"
        type="button"
        :class="['chai-composer__optimize', { 'chai-composer__optimize--active': enhanceBusy }]"
        :disabled="disabled || (isEnhanced ? false : !value.trim() || enhanceBusy)"
        :aria-label="optimizeName"
        :title="optimizeName"
        @click="onOptimizeClick"
      >
        <UndoIcon v-if="isEnhanced" /><OptimizeIcon v-else />
      </button>
    </div>
    <div class="chai-composer__field chai-composer__field--boxed">
      <textarea
        :id="id"
        ref="textarea"
        :class="['chai-composer__input chai-composer__type', { 'chai-composer__input--revealing': animating }]"
        :value="value"
        :placeholder="placeholder"
        :aria-describedby="hint ? `${id}-hint` : undefined"
        rows="1"
        :disabled="disabled || animating"
        @input="emit('change', ($event.target as HTMLTextAreaElement).value)"
        @focus="onFocus?.()"
      />
      <div v-if="animating" class="chai-composer__reveal chai-composer__type" aria-hidden="true">
        <span class="chai-composer__reveal-text">{{ animatingText!.slice(0, revealedLength) }}</span>
      </div>
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="chai-composer__field-hint">{{ hint }}</p>
  </div>

  <div v-else class="chai-composer__field">
    <textarea
      :id="id"
      ref="textarea"
      :class="['chai-composer__input chai-composer__type', { 'chai-composer__input--revealing': animating }]"
      :value="value"
      :placeholder="placeholder"
      :aria-label="label ?? placeholder"
      rows="1"
      :disabled="disabled || animating"
      @input="emit('change', ($event.target as HTMLTextAreaElement).value)"
    />
    <!-- The Enhance reveal: decorative, so hidden from screen readers, which read the textarea's final text. -->
    <div v-if="animating" class="chai-composer__reveal chai-composer__type" aria-hidden="true">
      <span class="chai-composer__reveal-text">{{ animatingText!.slice(0, revealedLength) }}</span>
    </div>
    <!-- Optimize, or once a rewrite lands, undo it: until the prompt is edited by hand. -->
    <button
      v-if="onEnhance"
      type="button"
      :class="['chai-composer__optimize', { 'chai-composer__optimize--active': enhanceBusy }]"
      :disabled="disabled || (isEnhanced ? false : !value.trim() || enhanceBusy)"
      :aria-label="optimizeName"
      :title="optimizeName"
      @click="onOptimizeClick"
    >
      <UndoIcon v-if="isEnhanced" /><OptimizeIcon v-else />
    </button>
  </div>
</template>
