<script setup lang="ts" generic="T extends SearchMenuOption">
/**
 * The searchable menu-button pattern behind every Model/option menu: a
 * trigger opening an anchored panel with a search field (a real
 * `<md-outlined-text-field>`) over a plain option list. Hand-rolled rather
 * than `<md-menu>`, so the panel sits inline under its trigger.
 */
import "@material/web/checkbox/checkbox.js";
import "@material/web/textfield/outlined-text-field.js";
import { computed, nextTick, ref, watch } from "vue";
import { useDismiss } from "../dismiss.js";
import { CheckIcon } from "../icons.js";
import Toggle from "./Toggle.vue";
import type { SearchMenuOption, SearchMenuSection, SearchMenuToggleHeader } from "./search-menu.js";

const props = withDefaults(
  defineProps<{
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
    disabled?: boolean;
    /** Show the search field. Off for a short fixed list. */
    searchable?: boolean;
    /** "outlined" matches `.chai-btn--outlined`; "text" is chevron and label only. */
    triggerVariant?: "outlined" | "text";
    /** Panel width in px; longer labels ellipsize. */
    panelWidth?: number;
  }>(),
  { searchable: true, triggerVariant: "outlined", panelWidth: 280 }
);
const emit = defineEmits<{ select: [option: T] }>();

const open = ref(false);
const search = ref("");
const root = ref<HTMLElement>();
const panel = ref<HTMLElement>();

// Closing also clears the search, so the menu reopens on the full list.
function close() {
  open.value = false;
  search.value = "";
}

// The panel opens from the trigger's left edge; near the right edge of a
// narrow screen it shifts left to fit, keeping a 16px margin on both sides.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  const el = panel.value!;
  const rect = el.getBoundingClientRect();
  const over = rect.right - (document.documentElement.clientWidth - 16);
  if (over > 0) el.style.left = `${-Math.min(over, Math.max(0, rect.left - 16))}px`;
});

useDismiss(root, open, close);

const groups = computed(() => {
  const q = search.value.trim().toLowerCase();
  const raw = props.sections ?? [{ label: "", options: props.options ?? [] }];
  if (!q) return raw;
  return raw
    .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q) || o.rowLabel?.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);
});
const hasAnyOption = computed(() => groups.value.some((g) => g.options.length > 0));
const isSelected = (id: string) => (Array.isArray(props.value) ? props.value.includes(id) : id === props.value);

function pick(option: T) {
  emit("select", option);
  if (!props.multiple) close();
}
</script>

<template>
  <div ref="root" class="chai-search-menu">
    <button
      type="button"
      :class="[
        triggerVariant === 'outlined' ? 'chai-btn chai-btn--outlined' : 'chai-search-menu__trigger--text',
        'chai-search-menu__trigger',
        { 'chai-search-menu__trigger--open': open },
      ]"
      :disabled="disabled"
      :aria-expanded="open"
      @click="open ? close() : (open = true)"
    >
      <span class="chai-search-menu__trigger-label" :title="triggerLabel">{{ triggerLabel }}</span>
      <!-- Material Symbols "keyboard_arrow_down". -->
      <svg :class="['chai-search-menu__chevron', { 'chai-search-menu__chevron--open': open }]" viewBox="0 -960 960 960" aria-hidden="true">
        <path d="M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z" fill="currentColor" />
      </svg>
    </button>

    <div v-if="open" ref="panel" class="chai-search-menu__panel" role="group" :aria-label="menuLabel" :style="{ width: `${panelWidth}px` }">
      <div v-if="toggleHeader" class="chai-search-menu__toggle-header">
        <span class="chai-search-menu__toggle-header-label">{{ menuLabel }}</span>
        <span class="chai-search-menu__toggle-header-row">
          <span class="chai-search-menu__toggle-header-text">{{ toggleHeader.label }}</span>
          <Toggle :model-value="toggleHeader.value" :aria-label="toggleHeader.label" @update:model-value="toggleHeader.onChange" />
        </span>
      </div>
      <md-outlined-text-field
        v-if="searchable"
        class="chai-search-menu__search"
        :label="menuLabel"
        placeholder="Input"
        :value.prop="search"
        @input="search = ($event.target as HTMLInputElement).value"
      >
        <span slot="leading-icon" class="chai-search-menu__search-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.5" />
            <path d="m20 20-3.6-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </span>
        <button v-if="search" type="button" slot="trailing-icon" class="chai-search-menu__clear" aria-label="Clear search" @click="search = ''">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
            <path d="m9 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </md-outlined-text-field>

      <ul class="chai-search-menu__list">
        <li v-for="(group, i) in groups" :key="group.label || i">
          <p v-if="group.label" class="chai-search-menu__section-label">{{ group.label }}</p>
          <ul class="chai-search-menu__section-list" :aria-label="group.label || undefined">
            <li v-for="o in group.options" :key="o.id">
              <!-- Plain buttons, reached with Tab: `aria-pressed` says which are picked. -->
              <button
                type="button"
                :aria-pressed="isSelected(o.id)"
                :disabled="toggleHeader?.value"
                :class="['chai-search-menu__option', { 'chai-search-menu__option--selected': !multiple && isSelected(o.id) }]"
                @click="pick(o)"
              >
                <!-- Display only: the row is the one control, so the checkbox is hidden from assistive tech and the tab order. -->
                <md-checkbox
                  v-if="multiple"
                  class="chai-search-menu__checkbox"
                  :checked.prop="isSelected(o.id)"
                  :disabled.prop="toggleHeader?.value ?? false"
                  tabindex="-1"
                  aria-hidden="true"
                />
                <span class="chai-search-menu__option-label">{{ o.rowLabel ?? o.label }}</span>
                <CheckIcon v-if="!multiple && isSelected(o.id)" />
              </button>
            </li>
          </ul>
          <hr v-if="i < groups.length - 1" class="chai-search-menu__divider" role="separator" />
        </li>
        <li v-if="!hasAnyOption" class="chai-search-menu__empty">No matches.</li>
      </ul>
    </div>
  </div>
</template>
