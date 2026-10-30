import type { Component } from "vue";

/** One of your own `+` menu items: see the Composer's `extraMenuItems`. */
export interface ComposerMenuItem {
  id: string;
  label: string;
  /** A 20px icon component, like the built-in items'. */
  icon?: Component;
  onSelect: () => void;
}

/** A context chip: see the Composer's `contextChips`. */
export interface ComposerContextChip {
  id: string;
  label: string;
  /** A 16px icon component before the label. */
  icon?: Component;
  onRemove?: () => void;
}
