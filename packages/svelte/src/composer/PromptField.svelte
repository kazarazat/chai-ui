<script lang="ts">
  /**
   * One prompt textarea with its Enhance button: grows with wrapped text,
   * reveals a rewrite as it lands, and offers undo until the text is edited by
   * hand. A `heading` gives it a visible label above a filled box (a world's
   * Environment and Character); without one it's the bar's plain prompt.
   */
  import { enhanceRevealDurationMs, MAX_ANIMATE_ENHANCE_LENGTH } from "@chai-ui/core";
  import Icon from "../Icon.svelte";
  import { OptimizeIcon, UndoIcon } from "../icons.js";

  let {
    value,
    placeholder,
    label,
    heading,
    note,
    hint,
    onEnhance,
    onRevert,
    onFocus,
    enhancing,
    disabled,
    onChange,
  }: {
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
    onChange: (value: string) => void;
  } = $props();
  const id = $props.id();

  // Grows with wrapped text from one line, instead of a fixed row count.
  let textarea = $state<HTMLTextAreaElement>();
  $effect(() => {
    void value;
    if (!textarea) return;
    textarea.style.height = "auto";
    // Empty, the placeholder sets the height: a long one wraps in a narrow
    // bar (a side panel) instead of being cut off at one line.
    if (!value && placeholder) {
      textarea.value = placeholder;
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.value = "";
    } else {
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  });

  // Enhance and undo. The prompt already holds the rewrite once `enhancing`
  // drops; the reveal is a decorative overlay painting it in, then gone.
  let originalValue = $state<string | null>(null);
  let enhancedValue = $state<string | null>(null);
  let animatingText = $state<string | null>(null);
  let revealedLength = $state(0);
  let raf = 0;

  // svelte-ignore state_referenced_locally
  let wasEnhancing = enhancing;
  $effect.pre(() => {
    const was = wasEnhancing;
    wasEnhancing = enhancing;
    if (!was || enhancing || originalValue == null || value === originalValue) return;
    const text = value;
    enhancedValue = text;
    // Long rewrites and reduced-motion requests appear at once.
    if (text.length > MAX_ANIMATE_ENHANCE_LENGTH || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    animatingText = text;
    revealedLength = 0;
    const duration = enhanceRevealDurationMs(text.length);
    const start = performance.now();
    const step = (time: number) => {
      revealedLength = Math.min(text.length, Math.floor(((time - start) / duration) * text.length));
      if (revealedLength < text.length) raf = requestAnimationFrame(step);
      else animatingText = null;
    };
    raf = requestAnimationFrame(step);
  });
  // An effect's cleanup, not onDestroy: onDestroy also runs on the server, which has no animation frames.
  $effect(() => () => cancelAnimationFrame(raf));

  const animating = $derived(animatingText != null);
  const isEnhanced = $derived(!animating && enhancedValue != null && value === enhancedValue);
  const enhanceBusy = $derived(enhancing || animating);
  const optimizeName = $derived(`${isEnhanced ? "Revert to original" : "Optimize"} ${heading ? heading.toLowerCase() : "prompt"}`);

  function onOptimizeClick() {
    if (isEnhanced) {
      const original = originalValue;
      enhancedValue = null;
      originalValue = null;
      if (original != null) onChange(original);
      onRevert?.();
      return;
    }
    originalValue = value; // for undo, before the rewrite lands
    onEnhance?.(value);
  }

  const oninput = (e: Event) => onChange((e.target as HTMLTextAreaElement).value);
</script>

{#snippet optimize()}
  <!-- Optimize, or once a rewrite lands, undo it: until the text is edited by hand. -->
  {#if onEnhance}
    <button
      type="button"
      class={["chai-composer__optimize", { "chai-composer__optimize--active": enhanceBusy }]}
      disabled={disabled || (isEnhanced ? false : !value.trim() || enhanceBusy)}
      aria-label={optimizeName}
      title={optimizeName}
      onclick={onOptimizeClick}
    >
      <Icon icon={isEnhanced ? UndoIcon : OptimizeIcon} />
    </button>
  {/if}
{/snippet}

{#snippet reveal()}
  <!-- The Enhance reveal: decorative, so hidden from screen readers, which read the textarea's final text. -->
  {#if animating}
    <div class="chai-composer__reveal chai-composer__type" aria-hidden="true">
      <span class="chai-composer__reveal-text">{animatingText!.slice(0, revealedLength)}</span>
    </div>
  {/if}
{/snippet}

{#if heading}
  <!-- A world's labeled field: heading and Enhance above a filled box. -->
  <div class="chai-composer__world-field">
    <div class="chai-composer__world-field-head">
      <label for={id} class="chai-composer__world-field-label"><strong>{heading}</strong> {note}</label>
      {@render optimize()}
    </div>
    <div class="chai-composer__field chai-composer__field--boxed">
      <textarea
        {id}
        bind:this={textarea}
        class={["chai-composer__input chai-composer__type", { "chai-composer__input--revealing": animating }]}
        {value}
        {placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        rows="1"
        disabled={disabled || animating}
        {oninput}
        onfocus={onFocus}
      ></textarea>
      {@render reveal()}
    </div>
    {#if hint}<p id={`${id}-hint`} class="chai-composer__field-hint">{hint}</p>{/if}
  </div>
{:else}
  <div class="chai-composer__field">
    <textarea
      {id}
      bind:this={textarea}
      class={["chai-composer__input chai-composer__type", { "chai-composer__input--revealing": animating }]}
      {value}
      {placeholder}
      aria-label={label ?? placeholder}
      rows="1"
      disabled={disabled || animating}
      {oninput}
    ></textarea>
    {@render reveal()}
    {@render optimize()}
  </div>
{/if}
