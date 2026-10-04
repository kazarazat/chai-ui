/**
 * CHAI UI — shared data types for the component library.
 */

/** The kinds of media a component can take in or produce. */
export type MediaKind = "image" | "video" | "audio" | "text";

/**
 * A piece of media a person attached (or an engine received) — just enough
 * to know its kind and where it lives.
 */
export interface DroppedMedia {
  src: string;
  kind: MediaKind;
  /** Original file name, for the upload-summary UI. Absent for non-file sources. */
  name?: string;
  /** Original file size in bytes, for the upload-summary UI. */
  size?: number;
}

/**
 * Token/cost accounting for one model call, when the engine reports one.
 * `costUsd` is deliberately separate from the token counts: an engine may
 * know real token counts but have no verified per-model pricing to convert
 * them with (see `ModelOption.pricePerMillionTokens`) — degrade to showing
 * tokens without a cost rather than guessing a price.
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
}

/**
 * The verdict of one quality check the builder's own backend ran on a
 * generated output (e.g. brand safety, prompt adherence), appended to the
 * model call's response. CHAI never runs or scores a check; it only
 * renders the verdict: `passed` true is green, false is red.
 */
export interface Evaluation {
  id: string;
  label: string;
  passed: boolean;
}

/**
 * The thin value-in/value-out shape a form control satisfies (e.g.
 * `Toggle`) — deliberately minimal so most existing components already
 * qualify without an adapter.
 */
export interface PrimitiveProps<T = unknown> {
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}

/** One labeled option, for option-list controls (e.g. Composer's aspect ratios). */
export interface ParameterOption<T> {
  value: T;
  label: string;
}

/** A model a component can offer or route to. */
export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  /** Rough cost/latency signal, for future cost/latency-aware routing. */
  speed: "fast" | "standard" | "slow";
  /**
   * USD per million tokens, if known — lets real token counts convert into
   * a real cost. Deliberately optional and absent by default: provider
   * pricing changes and isn't tracked anywhere in this repo yet, so a wrong
   * hardcoded number would be worse than no cost at all. Set this per model
   * only from a source you're actively keeping current.
   */
  pricePerMillionTokens?: { input: number; output: number };
  /**
   * For image-edit models: how marked regions are sent. `"flux-3-boxes"`
   * writes each region as a box the model reads (Flux 3 Image). Absent, the
   * regions are described in words, which any edit model accepts but
   * places less precisely. See `buildRegionEditPrompt`.
   */
  regionFormat?: RegionFormat;
  /** For image-edit models: the most regions one edit takes. `EditCard` disables "New region" at this many. */
  maxRegions?: number;
}

/** How an edit's regions reach the model — see `ModelOption.regionFormat`. */
export type RegionFormat = "flux-3-boxes" | "text";

/**
 * A specific generation use case. These names deliberately match the
 * leaderboard categories at github.com/oolong-tea-2026/arena-ai-leaderboards,
 * so a future model-ranking lookup can join on it directly, plus
 * "text-to-text" for a plain text request (a Composer with no use case
 * picked). That repo has no audio-generation category at all, a real gap
 * for any future audio use case.
 */
export type GenerationUseCase =
  | "text-to-image"
  | "image-edit"
  | "text-to-video"
  | "image-to-video"
  | "video-edit"
  | "vision"
  | "text-to-text";
