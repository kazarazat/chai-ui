import type { Component } from "vue";

/** One row in the "more" (⋯) menu, for app-specific actions (e.g. "Flag content"). Each one just emits `action` with this `id`. */
export interface ResultCardMoreAction {
  id: string;
  label: string;
  icon?: Component;
}

export type ResultCardVote = "like" | "dislike" | null;
