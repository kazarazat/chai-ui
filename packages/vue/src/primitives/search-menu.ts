export interface SearchMenuOption {
  id: string;
  /** Shown on the trigger once selected, and searched. Keep it the short name. */
  label: string;
  /** Shown in the option row instead of `label`, e.g. "Terse (short)". */
  rowLabel?: string;
}

/** One labeled group of options, under its own header with a divider before the next. */
export interface SearchMenuSection<T extends SearchMenuOption> {
  label: string;
  options: T[];
}

/** A toggle pinned above every group, e.g. "Auto-select model". While on, the rows are disabled but keep their check. */
export interface SearchMenuToggleHeader {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}
