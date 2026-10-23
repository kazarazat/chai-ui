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
  | { name: "chai_result_info_opened"; properties: Record<string, never> };

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
