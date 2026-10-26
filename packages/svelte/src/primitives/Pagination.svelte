<script lang="ts">
  /**
   * Progress-style pager: a pill that fills from page 1 up to the current page
   * under a row of plain dots. One slider, not a button per dot (the dots sit
   * closer than WCAG 2.2's 24px target spacing allows): a click picks the
   * nearest dot; arrow keys, Home and End move between pages.
   */
  let {
    count,
    index,
    onChange,
    label,
    itemLabel = "Result",
    disabled = false,
  }: {
    count: number;
    index: number;
    onChange: (index: number) => void;
    /** Accessible name for the pager, e.g. "Results". */
    label: string;
    /** What one page is, for the current position ("Result 2 of 3"). */
    itemLabel?: string;
    disabled?: boolean;
  } = $props();

  function go(next: number) {
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped !== index) onChange(clamped);
  }

  function onclick(e: MouseEvent) {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(Math.floor(((e.clientX - rect.left) / rect.width) * count));
  }

  const KEY_STEPS: Record<string, (i: number, count: number) => number> = {
    ArrowRight: (i) => i + 1,
    ArrowUp: (i) => i + 1,
    PageDown: (i) => i + 1,
    ArrowLeft: (i) => i - 1,
    ArrowDown: (i) => i - 1,
    PageUp: (i) => i - 1,
    Home: () => 0,
    End: (_, count) => count - 1,
  };

  function onkeydown(e: KeyboardEvent) {
    const step = KEY_STEPS[e.key];
    if (disabled || !step) return;
    e.preventDefault();
    go(step(index, count));
  }
</script>

<div
  class={["chai-pagination", { "chai-pagination--disabled": disabled }]}
  role="slider"
  aria-label={label}
  aria-valuemin={1}
  aria-valuemax={count}
  aria-valuenow={index + 1}
  aria-valuetext={`${itemLabel} ${index + 1} of ${count}`}
  aria-disabled={disabled || undefined}
  tabindex={disabled ? -1 : 0}
  style:--chai-pagination-fill={`${((index + 1) / count) * 100}%`}
  {onclick}
  {onkeydown}
>
  <span class="chai-pagination__track" aria-hidden="true"></span>
  {#each { length: count }, i (i)}
    <span class={["chai-pagination__dot", { "chai-pagination__dot--filled": i <= index }]} aria-hidden="true"></span>
  {/each}
</div>
