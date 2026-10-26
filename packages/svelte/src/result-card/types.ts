import type { Component } from "svelte";

/** One row in the "more" (⋯) menu, for app-specific actions (e.g. "Flag content"). Each one just calls `onAction` with this `id`. */
export interface ResultCardMoreAction {
  id: string;
  label: string;
  /** A Svelte component for the row's icon. */
  icon?: Component;
}

export type ResultCardVote = "like" | "dislike" | null;
