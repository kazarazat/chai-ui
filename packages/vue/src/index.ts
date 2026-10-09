export { default as ChaiProvider } from "./ChaiProvider.vue";
export { default as Composer } from "./Composer.vue";
export { default as ResultCard } from "./ResultCard.vue";
export { default as MediaAnalyzer } from "./MediaAnalyzer.vue";
export { default as Pagination } from "./primitives/Pagination.vue";
export { default as SearchMenu } from "./primitives/SearchMenu.vue";
export { default as Toggle } from "./primitives/Toggle.vue";
export type { SearchMenuOption, SearchMenuSection, SearchMenuToggleHeader } from "./primitives/search-menu.js";
export type { ResultCardMoreAction, ResultCardVote } from "./result-card/types.js";
export * from "./reasoning.js";
export * from "./useComposer.js";
export * from "./useMediaAnalyzer.js";

// Re-export the core engines and types so a consumer typically only needs
// to import from @chai-ui/vue.
export {
  createFalEngine,
  createOpenRouterEngine,
  createMockEngine,
  mockEngine,
  buildRegionEditPrompt,
  DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  DEFAULT_MAX_REGIONS,
  DEFAULT_MODEL_ID,
  DEFAULT_REASONING_MODEL,
  DEFAULT_REASONING_MODEL_BY_KIND,
  EDIT_IMAGE_USE_CASE,
  TEXT_USE_CASE,
  PRECISE_EDIT_MODELS,
  ROUTING_MODEL_ID,
  GenerationError,
  isMediaAnalyzerAtCap,
  nextMediaAnalyzerAttachments,
  DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH,
  MEDIA_ANALYSIS_PROMPTS,
  MEDIA_ANALYSIS_PROMPT_LENGTHS,
  SUGGESTED_IMAGE_MODELS,
  SUGGESTED_TEXT_TO_VIDEO_MODELS,
  SUGGESTED_IMAGE_TO_VIDEO_MODELS,
  SUGGESTED_EDIT_MODELS,
  SUGGESTED_ANALYSIS_MODELS,
  reasoningModelFor,
  suggestedModels,
  checkSuggestedModels,
} from "@chai-ui/core";
export type {
  ComposerAttachMenuAction,
  ComposerAttachment,
  ComposerSelection,
  ComposerSubmitPayload,
  ComposerUseCase,
  DroppedMedia,
  EditRegion,
  EditVersion,
  Evaluation,
  GenerationEngine,
  GenerationUseCase,
  MediaAnalysisKind,
  MediaAnalysisPromptLength,
  MediaAnalyzerAttachment,
  MediaAnalyzerSubmitPayload,
  MediaKind,
  ModelOption,
  ParameterOption,
  Reasoning,
  RegionBox,
  RegionFormat,
  Request,
  Result,
  ResultStatus,
  Run,
  SuggestedModelProblem,
  SuggestedModelsCheck,
  FalInputFormat,
  Usage,
} from "@chai-ui/core";
