export * from "./primitives/index.js";
export * from "./Composer.js";
export * from "./MediaAnalyzer.js";
export * from "./ResultCard.js";
export * from "./EditCard.js";
export * from "./useComposer.js";
export * from "./ChaiProvider.js";
export * from "./useMediaAnalyzer.js";

// Re-export the core engines and types so a consumer typically only needs
// to import from @chai-ui/react.
export {
  createFalEngine,
  createOpenRouterEngine,
  createMockEngine,
  mockEngine,
  buildRegionEditPrompt,
  DEFAULT_MAX_REGIONS,
  PRECISE_EDIT_MODELS,
  ROUTING_MODEL_ID,
  GenerationError,
  DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH,
  MEDIA_ANALYSIS_PROMPTS,
  MEDIA_ANALYSIS_PROMPT_LENGTHS,
} from "@chai-ui/core";
export type {
  DroppedMedia,
  EditRegion,
  Evaluation,
  GenerationEngine,
  GenerationUseCase,
  MediaAnalysisKind,
  MediaAnalysisPromptLength,
  MediaKind,
  ModelOption,
  ParameterOption,
  RegionBox,
  RegionFormat,
  Request,
  Result,
  ResultStatus,
  Run,
  Usage,
} from "@chai-ui/core";
