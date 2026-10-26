<script lang="ts" generics="T extends SearchMenuOption">
  /**
   * The searchable menu-button pattern behind every Model/option menu: a
   * trigger opening an anchored panel with a search field (a real
   * `<md-outlined-text-field>`) over a plain option list. Hand-rolled rather
   * than `<md-menu>`, so the panel sits inline under its trigger.
   */
  import "@material/web/checkbox/checkbox.js";
  import "@material/web/textfield/outlined-text-field.js";
  import { tick } from "svelte";
  import { menuOpensAbove, type MenuPlacement } from "@chai-ui/core";
  import { useDismiss } from "../dismiss.svelte.js";
  import Icon from "../Icon.svelte";
  import { CheckIcon } from "../icons.js";
  import Toggle from "./Toggle.svelte";
  import type { SearchMenuOption, SearchMenuSection, SearchMenuToggleHeader } from "./search-menu.js";

  let {
    options,
    sections,
    toggleHeader,
    value,
    multiple = false,
    triggerLabel,
    menuLabel,
    onSelect,
    disabled = false,
    searchable = true,
    triggerVariant = "outlined",
    panelWidth = 280,
    placement = "auto",
  }: {
    /** A flat option list. Ignored if `sections` is given. */
    options?: T[];
    /** Grouped options, each under its own header with a divider between groups. */
    sections?: SearchMenuSection<T>[];
    /** A toggle pinned above the options (e.g. "Auto-select model"); while on, the rows are disabled but keep their check. */
    toggleHeader?: SearchMenuToggleHeader;
    /** The checked option's id, or ids with `multiple`. */
    value: string | string[] | null;
    /** Several options can be checked: each row gets a checkbox and the panel stays open on a pick. */
    multiple?: boolean;
    triggerLabel: string;
    /** Floating label on the search field, and the panel's accessible name. */
    menuLabel: string;
    onSelect: (option: T) => void;
    disabled?: boolean;
    /** Show the search field. Off for a short fixed list. */
    searchable?: boolean;
    /** "outlined" matches `.chai-btn--outlined`; "text" is chevron and label only. */
    triggerVariant?: "outlined" | "text";
    /** Panel width in px; longer labels ellipsize. */
    panelWidth?: number;
    /** Which way the panel opens: "auto" (default) below when it fits, else above when that fits, else toward the side with more room. */
    placement?: MenuPlacement;
  } = $props();

  let open = $state(false);
  let above = $state(false);
  let search = $state("");
  let root = $state<HTMLElement>();
  let panel = $state<HTMLElement>();

  // Closing also clears the search, so the menu reopens on the full list.
  function close() {
    open = false;
    search = "";
  }

  // The panel opens from the trigger's left edge; near the right edge of a
  // narrow screen it shifts left to fit, keeping a 16px margin on both sides.
  async function openPanel() {
    open = true;
    await tick();
    const el = panel!;
    const rect = el.getBoundingClientRect();
    const over = rect.right - (document.documentElement.clientWidth - 16);
    if (over > 0) el.style.left = `${-Math.min(over, Math.max(0, rect.left - 16))}px`;
    // Up or down, before the first paint, so it never flashes on the wrong side.
    above = menuOpensAbove(placement, root!.getBoundingClientRect(), el.offsetHeight, document.documentElement.clientHeight);
  }

  useDismiss(
    () => root,
    () => open,
    close
  );

  const groups = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const raw = sections ?? [{ label: "", options: options ?? [] }];
    if (!q) return raw;
    return raw
      .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q) || o.rowLabel?.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  });
  const hasAnyOption = $derived(groups.some((g) => g.options.length > 0));
  const isSelected = (id: string) => (Array.isArray(value) ? value.includes(id) : id === value);

  function pick(option: T) {
    onSelect(option);
    if (!multiple) close();
  }
</script>

<div bind:this={root} class="chai-search-menu">
  <button
    type="button"
    class={[
      triggerVariant === "outlined" ? "chai-btn chai-btn--outlined" : "chai-search-menu__trigger--text",
      "chai-search-menu__trigger",
      { "chai-search-menu__trigger--open": open },
    ]}
    {disabled}
    aria-expanded={open}
    onclick={() => (open ? close() : void openPanel())}
  >
    <span class="chai-search-menu__trigger-label" title={triggerLabel}>{triggerLabel}</span>
    <!-- Material Symbols "keyboard_arrow_down". -->
    <svg class={["chai-search-menu__chevron", { "chai-search-menu__chevron--open": open }]} viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z" fill="currentColor" />
    </svg>
  </button>

  {#if open}
    <div
      bind:this={panel}
      class={["chai-search-menu__panel", { "chai-search-menu__panel--above": above }]}
      role="group"
      aria-label={menuLabel}
      style:width={`${panelWidth}px`}
    >
      {#if toggleHeader}
        <div class="chai-search-menu__toggle-header">
          <span class="chai-search-menu__toggle-header-label">{menuLabel}</span>
          <span class="chai-search-menu__toggle-header-row">
            <span class="chai-search-menu__toggle-header-text">{toggleHeader.label}</span>
            <Toggle value={toggleHeader.value} ariaLabel={toggleHeader.label} onChange={toggleHeader.onChange} />
          </span>
        </div>
      {/if}
      {#if searchable}
        <md-outlined-text-field
          class="chai-search-menu__search"
          label={menuLabel}
          placeholder="Search"
          value={search}
          oninput={(e: Event) => (search = (e.target as HTMLInputElement).value)}
        >
          <span slot="leading-icon" class="chai-search-menu__search-icon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.5" />
              <path d="m20 20-3.6-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </span>
          {#if search}
            <button type="button" slot="trailing-icon" class="chai-search-menu__clear" aria-label="Clear search" onclick={() => (search = "")}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
                <path d="m9 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          {/if}
        </md-outlined-text-field>
      {/if}

      <ul class="chai-search-menu__list">
        {#each groups as group, i (group.label || i)}
          <li>
            {#if group.label}<p class="chai-search-menu__section-label">{group.label}</p>{/if}
            <ul class="chai-search-menu__section-list" aria-label={group.label || undefined}>
              {#each group.options as o (o.id)}
                <li>
                  <!-- Plain buttons, reached with Tab: `aria-pressed` says which are picked. -->
                  <button
                    type="button"
                    aria-pressed={isSelected(o.id)}
                    disabled={toggleHeader?.value}
                    class={["chai-search-menu__option", { "chai-search-menu__option--selected": !multiple && isSelected(o.id) }]}
                    onclick={() => pick(o)}
                  >
                    <!-- Display only: the row is the one control, so the checkbox is hidden from assistive tech and the tab order. -->
                    {#if multiple}
                      <md-checkbox
                        class="chai-search-menu__checkbox"
                        checked={isSelected(o.id)}
                        disabled={toggleHeader?.value ?? false}
                        tabindex="-1"
                        aria-hidden="true"
                      ></md-checkbox>
                    {/if}
                    <span class="chai-search-menu__option-label">{o.rowLabel ?? o.label}</span>
                    {#if !multiple && isSelected(o.id)}<Icon icon={CheckIcon} />{/if}
                  </button>
                </li>
              {/each}
            </ul>
            {#if i < groups.length - 1}<hr class="chai-search-menu__divider" />{/if}
          </li>
        {/each}
        {#if !hasAnyOption}<li class="chai-search-menu__empty">No matches.</li>{/if}
      </ul>
    </div>
  {/if}
</div>
