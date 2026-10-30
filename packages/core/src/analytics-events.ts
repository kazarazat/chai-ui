/**
 * Front-end analytics: what the person did in Chai's components and what
 * the components showed them, reported through each component's `onEvent`.
 * Defined once here so every framework binding sends the same events.
 *
 * Front end only: model calls, latency, cost and storage belong to the
 * builder's back end. No prompt text, file names, URLs or outputs are ever
 * sent: only lengths, counts and Chai's own ids. Properties are flat, so any
 * analytics tool takes them as they are: `onEvent={(e) => posthog.capture(e.name, e.properties)}`.
 */
import type { ComposerAttachMenuAction, ComposerPromptField } from "./composer-view.js";
import type { ComposerSubmitPayload, ComposerUseCase } from "./composer.js";
import type { MediaAnalysisPromptLength } from "./media-analysis-prompts.js";
import type { MediaKind } from "./types.js";

export type ChaiEvent =
  | {
      name: "chai_composer_submitted";
      properties: {
        use_cases: string;
        model_count: number;
        auto_select: boolean;
        aspect_ratio?: string;
        attachment_count: number;
        prompt_length: number;
        retry: boolean;
      };
    }
  | { name: "chai_composer_stopped"; properties: Record<string, never> }
  | { name: "chai_composer_use_case_picked"; properties: { action: ComposerAttachMenuAction } }
  | { name: "chai_composer_use_case_removed"; properties: { use_case: string } }
  | { name: "chai_composer_media_attached"; properties: { count: number; unsupported_count: number } }
  | { name: "chai_composer_model_picked"; properties: { use_case: string; model_id: string } }
  | { name: "chai_composer_auto_select_toggled"; properties: { on: boolean } }
  | {
      name: "chai_composer_option_picked";
      properties: { option: "aspect_ratio" | "voice" | "genre" | "frame_rate"; value: string };
    }
  | { name: "chai_composer_enhance_clicked"; properties: { field: ComposerPromptField; prompt_length: number } }
  | { name: "chai_composer_enhance_reverted"; properties: { field: ComposerPromptField } }
  | { name: "chai_composer_voice_started"; properties: Record<string, never> }
  | {
      name: "chai_result_shown";
      properties: { status: "done" | "error"; output_kind?: MediaKind; result_count: number };
    }
  | { name: "chai_result_action"; properties: { action: string } }
  | { name: "chai_result_paged"; properties: { index: number; count: number } }
  | { name: "chai_result_info_opened"; properties: Record<string, never> }
  | { name: "chai_side_panel_opened"; properties: Record<string, never> }
  | { name: "chai_side_panel_closed"; properties: { turn_count: number } }
  | { name: "chai_side_panel_new_chat"; properties: { turn_count: number } }
  | { name: "chai_side_panel_tip_used"; properties: { index: number } }
  | { name: "chai_side_panel_page_context_toggled"; properties: { on: boolean } }
  | { name: "chai_media_analyzer_media_attached"; properties: { count: number; unsupported_count: number } }
  | { name: "chai_media_analyzer_media_removed"; properties: { remaining: number } }
  | { name: "chai_media_analyzer_model_picked"; properties: { media_kind?: MediaKind; model_id: string } }
  | { name: "chai_media_analyzer_auto_select_toggled"; properties: { on: boolean } }
  | { name: "chai_media_analyzer_prompt_length_picked"; properties: { length: MediaAnalysisPromptLength } }
  | {
      name: "chai_media_analyzer_submitted";
      properties: {
        media_kind?: MediaKind;
        attachment_count: number;
        auto_select: boolean;
        prompt_length?: MediaAnalysisPromptLength;
        retry: boolean;
      };
    }
  | { name: "chai_media_analyzer_stopped"; properties: Record<string, never> }
  | { name: "chai_media_analyzer_finished"; properties: { status: "done" | "error" } }
  | { name: "chai_edit_region_added"; properties: { region_count: number } }
  | { name: "chai_edit_region_confirmed"; properties: { region_count: number; instruction_length: number } }
  | { name: "chai_edit_region_removed"; properties: { region_count: number } }
  | { name: "chai_edit_zoomed"; properties: { zoom: number } }
  | { name: "chai_edit_version_paged"; properties: { index: number; count: number } }
  | { name: "chai_edit_action"; properties: { action: "download" | "share" } };

export type ChaiEventName = ChaiEvent["name"];

/** A use case as one short id, e.g. `"image"`, `"image:edit"` or `"audio:music"`. */
export function useCaseId(useCase: ComposerUseCase): string {
  return `${useCase.kind}${useCase.edit ? ":edit" : ""}${useCase.audio ? `:${useCase.audio}` : ""}`;
}

/** The events `Composer` reports. */
export const composerEvents = {
  submitted: (payload: ComposerSubmitPayload, retry: boolean): ChaiEvent => ({
    name: "chai_composer_submitted",
    properties: {
      use_cases: payload.selections.map((s) => useCaseId(s.useCase)).join(","),
      model_count: payload.selections.reduce((n, s) => n + s.modelIds.length, 0),
      auto_select: payload.autoSelectModel,
      ...(payload.aspectRatio && { aspect_ratio: payload.aspectRatio }),
      attachment_count: payload.attachments.length,
      prompt_length: payload.value.length,
      retry,
    },
  }),
  stopped: (): ChaiEvent => ({ name: "chai_composer_stopped", properties: {} }),
  useCasePicked: (action: ComposerAttachMenuAction): ChaiEvent => ({ name: "chai_composer_use_case_picked", properties: { action } }),
  useCaseRemoved: (useCase: ComposerUseCase): ChaiEvent => ({
    name: "chai_composer_use_case_removed",
    properties: { use_case: useCaseId(useCase) },
  }),
  mediaAttached: (count: number, unsupportedCount: number): ChaiEvent => ({
    name: "chai_composer_media_attached",
    properties: { count, unsupported_count: unsupportedCount },
  }),
  modelPicked: (useCase: string, modelId: string): ChaiEvent => ({
    name: "chai_composer_model_picked",
    properties: { use_case: useCase, model_id: modelId },
  }),
  autoSelectToggled: (on: boolean): ChaiEvent => ({ name: "chai_composer_auto_select_toggled", properties: { on } }),
  optionPicked: (option: "aspect_ratio" | "voice" | "genre" | "frame_rate", value: string | number): ChaiEvent => ({
    name: "chai_composer_option_picked",
    properties: { option, value: String(value) },
  }),
  enhanceClicked: (field: ComposerPromptField, promptLength: number): ChaiEvent => ({
    name: "chai_composer_enhance_clicked",
    properties: { field, prompt_length: promptLength },
  }),
  enhanceReverted: (field: ComposerPromptField): ChaiEvent => ({ name: "chai_composer_enhance_reverted", properties: { field } }),
  voiceStarted: (): ChaiEvent => ({ name: "chai_composer_voice_started", properties: {} }),
};

/** The events `ResultCard` reports. */
export const resultCardEvents = {
  shown: (status: "done" | "error", outputKind: MediaKind | undefined, resultCount: number): ChaiEvent => ({
    name: "chai_result_shown",
    properties: { status, ...(outputKind && { output_kind: outputKind }), result_count: resultCount },
  }),
  action: (action: string): ChaiEvent => ({ name: "chai_result_action", properties: { action } }),
  paged: (index: number, count: number): ChaiEvent => ({ name: "chai_result_paged", properties: { index, count } }),
  infoOpened: (): ChaiEvent => ({ name: "chai_result_info_opened", properties: {} }),
};

/** The events `SidePanel` reports. Its Composer and answers report theirs too (`composerEvents`, `resultCardEvents`). */
export const sidePanelEvents = {
  opened: (): ChaiEvent => ({ name: "chai_side_panel_opened", properties: {} }),
  closed: (turnCount: number): ChaiEvent => ({ name: "chai_side_panel_closed", properties: { turn_count: turnCount } }),
  newChat: (turnCount: number): ChaiEvent => ({ name: "chai_side_panel_new_chat", properties: { turn_count: turnCount } }),
  /** Which prompt tip, by position: never its text. */
  tipUsed: (index: number): ChaiEvent => ({ name: "chai_side_panel_tip_used", properties: { index } }),
  pageContextToggled: (on: boolean): ChaiEvent => ({ name: "chai_side_panel_page_context_toggled", properties: { on } }),
};

/** The events `MediaAnalyzer` reports. Where its prompt goes next is the app's, and so are that component's events (e.g. the Composer's). */
export const mediaAnalyzerEvents = {
  mediaAttached: (count: number, unsupportedCount: number): ChaiEvent => ({
    name: "chai_media_analyzer_media_attached",
    properties: { count, unsupported_count: unsupportedCount },
  }),
  mediaRemoved: (remaining: number): ChaiEvent => ({ name: "chai_media_analyzer_media_removed", properties: { remaining } }),
  modelPicked: (mediaKind: MediaKind | undefined, modelId: string): ChaiEvent => ({
    name: "chai_media_analyzer_model_picked",
    properties: { ...(mediaKind && { media_kind: mediaKind }), model_id: modelId },
  }),
  autoSelectToggled: (on: boolean): ChaiEvent => ({ name: "chai_media_analyzer_auto_select_toggled", properties: { on } }),
  promptLengthPicked: (length: MediaAnalysisPromptLength): ChaiEvent => ({
    name: "chai_media_analyzer_prompt_length_picked",
    properties: { length },
  }),
  submitted: (
    mediaKind: MediaKind | undefined,
    attachmentCount: number,
    autoSelect: boolean,
    promptLength: MediaAnalysisPromptLength | null,
    retry: boolean
  ): ChaiEvent => ({
    name: "chai_media_analyzer_submitted",
    properties: {
      ...(mediaKind && { media_kind: mediaKind }),
      attachment_count: attachmentCount,
      auto_select: autoSelect,
      ...(promptLength && { prompt_length: promptLength }),
      retry,
    },
  }),
  stopped: (): ChaiEvent => ({ name: "chai_media_analyzer_stopped", properties: {} }),
  finished: (status: "done" | "error"): ChaiEvent => ({ name: "chai_media_analyzer_finished", properties: { status } }),
};

/** The events `EditCard` reports. Moving and resizing a region aren't reported: every drag would send one. */
export const editCardEvents = {
  regionAdded: (regionCount: number): ChaiEvent => ({ name: "chai_edit_region_added", properties: { region_count: regionCount } }),
  regionConfirmed: (regionCount: number, instructionLength: number): ChaiEvent => ({
    name: "chai_edit_region_confirmed",
    properties: { region_count: regionCount, instruction_length: instructionLength },
  }),
  regionRemoved: (regionCount: number): ChaiEvent => ({ name: "chai_edit_region_removed", properties: { region_count: regionCount } }),
  zoomed: (zoom: number): ChaiEvent => ({ name: "chai_edit_zoomed", properties: { zoom } }),
  versionPaged: (index: number, count: number): ChaiEvent => ({ name: "chai_edit_version_paged", properties: { index, count } }),
  action: (action: "download" | "share"): ChaiEvent => ({ name: "chai_edit_action", properties: { action } }),
};
