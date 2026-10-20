/**
 * CHAI UI — shared data types for the component library.
 */

/** The kinds of media a component can take in or produce. */
export type MediaKind = "image" | "video" | "audio" | "text";

/**
 * What a generation produces: any `MediaKind`, or an interactive world from
 * a world model (Create world). A world is never an attachment, so it lives
 * here rather than in `MediaKind`.
 */
export type OutputKind = MediaKind | "world";

/**
 * Which audio an `"audio"` use case creates: spoken words (Create speech) or
 * music (Create music). Each needs its own models and result surface, so a
 * new kind of audio (e.g. sound effects) gets its own value, not a reuse.
 */
export type AudioUseCase = "speech" | "music";

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
  /**
   * The model's short display name, as menus and result cards show it:
   * "Nano Banana Pro", not "Nano Banana Pro (Gemini 3 Pro Image)". No
   * parentheses, even when the provider's own name has them; the
   * Composer's use case already says what the model is for.
   */
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
  /**
   * How a Fal model takes its inputs, from its Fal schema: which field the
   * attached image goes in, and whether the aspect ratio is sent as
   * `aspect_ratio` or as a named `image_size`. The suggested lists carry it;
   * without it the Fal engine guesses from the id.
   */
  falInput?: FalInputFormat;
  /**
   * The output aspect ratios the model takes, e.g. `["1:1", "16:9", "9:16"]`.
   * Composer's Aspect ratio menu offers only ratios the selected models
   * share, and the engine sends the pick in the model's own format. Leave
   * it out for a model that sets the shape itself (image-to-video follows
   * the input image): no menu shows.
   */
  aspectRatios?: string[];
  /**
   * The frame rates a world model runs at, e.g. `[16]`. Composer's frame
   * rate menu offers only rates the selected models share. Leave it out for
   * a model with one fixed rate it doesn't take as an input: no menu shows.
   */
  frameRates?: number[];
  /**
   * The voices a text-to-speech model speaks in, from its schema. Composer's
   * Voice menu offers them once this is the one model picked, and the
   * engine sends the pick as the model's `voice` input. Leave it out for a
   * model with no voice to choose.
   */
  voices?: VoiceOption[];
  /**
   * The genres offered with a music model. Composer's Genre menu offers the
   * ones every picked model lists, several at once. Music models take genre
   * as part of the description, so the picks are written into the prompt
   * (see `promptWithGenres`).
   */
  genres?: ParameterOption<string>[];
}

/** One voice in `ModelOption.voices`: the model's own id for it, its name, and an optional menu section (e.g. "Female"). */
export interface VoiceOption extends ParameterOption<string> {
  group?: string;
}

/** See `ModelOption.falInput`. */
export interface FalInputFormat {
  image?: "image_url" | "image_urls" | "start_image_url";
  aspectRatio?: "aspect_ratio" | "image_size";
  /** Which field the prompt goes in. Most models take `prompt`; some text-to-speech models take the words as `text`. */
  prompt?: "prompt" | "text";
}

/** How an edit's regions reach the model — see `ModelOption.regionFormat`. */
export type RegionFormat = "flux-3-boxes" | "text";

/**
 * A specific generation use case. These names deliberately match the
 * leaderboard categories at github.com/oolong-tea-2026/arena-ai-leaderboards,
 * so a future model-ranking lookup can join on it directly, plus
 * "text-to-text" for a plain text request (a Composer with no use case
 * picked). That repo has no audio-generation category, so "text-to-speech"
 * and "text-to-music" have nothing to join on yet.
 */
export type GenerationUseCase =
  | "text-to-image"
  | "image-edit"
  | "text-to-video"
  | "image-to-video"
  | "video-edit"
  | "vision"
  | "text-to-text"
  | "text-to-speech"
  | "text-to-music";
