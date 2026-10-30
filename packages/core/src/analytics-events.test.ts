import { describe, expect, it } from "vitest";
import { composerEvents, resultCardEvents, sidePanelEvents, useCaseId } from "./analytics-events.js";
import { CREATE_MUSIC_USE_CASE, EDIT_IMAGE_USE_CASE, type ComposerSubmitPayload } from "./composer.js";

describe("analytics events", () => {
  it("names a use case by kind, edit and audio type", () => {
    expect(useCaseId({ kind: "image", label: "Image" })).toBe("image");
    expect(useCaseId(EDIT_IMAGE_USE_CASE)).toBe("image:edit");
    expect(useCaseId(CREATE_MUSIC_USE_CASE)).toBe("audio:music");
  });

  it("describes a submit with counts and lengths only, leaving out an unset aspect ratio", () => {
    const image = { kind: "image" as const, label: "Image" };
    const video = { kind: "video" as const, label: "Video" };
    const payload: ComposerSubmitPayload = {
      value: "a secret prompt",
      attachments: [{ src: "data:", kind: "image" }],
      useCase: image,
      modelId: "a",
      aspectRatio: null,
      autoSelectModel: true,
      regions: [],
      selections: [
        { useCase: image, modelIds: ["a", "b"], models: [] },
        { useCase: video, modelIds: ["c"], models: [] },
      ],
    };
    expect(composerEvents.submitted(payload, true)).toEqual({
      name: "chai_composer_submitted",
      properties: { use_cases: "image,video", model_count: 3, auto_select: true, attachment_count: 1, prompt_length: 15, retry: true },
    });
  });

  it("builds the rest of the Composer's and ResultCard's events", () => {
    expect([
      composerEvents.mediaAttached(2, 1),
      composerEvents.autoSelectToggled(true),
      composerEvents.optionPicked("frame_rate", 24),
      composerEvents.voiceStarted(),
      composerEvents.stopped(),
      composerEvents.useCasePicked("create-video"),
      composerEvents.useCaseRemoved(EDIT_IMAGE_USE_CASE),
      composerEvents.modelPicked("image", "m"),
      composerEvents.enhanceClicked("character", 4),
      composerEvents.enhanceReverted("character"),
      resultCardEvents.shown("error", undefined, 1),
      resultCardEvents.shown("done", "video", 2),
      resultCardEvents.action("download"),
      resultCardEvents.paged(1, 3),
      resultCardEvents.infoOpened(),
      sidePanelEvents.opened(),
      sidePanelEvents.closed(3),
      sidePanelEvents.newChat(2),
      sidePanelEvents.tipUsed(1),
      sidePanelEvents.pageContextToggled(false),
    ]).toEqual([
      { name: "chai_composer_media_attached", properties: { count: 2, unsupported_count: 1 } },
      { name: "chai_composer_auto_select_toggled", properties: { on: true } },
      { name: "chai_composer_option_picked", properties: { option: "frame_rate", value: "24" } },
      { name: "chai_composer_voice_started", properties: {} },
      { name: "chai_composer_stopped", properties: {} },
      { name: "chai_composer_use_case_picked", properties: { action: "create-video" } },
      { name: "chai_composer_use_case_removed", properties: { use_case: "image:edit" } },
      { name: "chai_composer_model_picked", properties: { use_case: "image", model_id: "m" } },
      { name: "chai_composer_enhance_clicked", properties: { field: "character", prompt_length: 4 } },
      { name: "chai_composer_enhance_reverted", properties: { field: "character" } },
      { name: "chai_result_shown", properties: { status: "error", result_count: 1 } },
      { name: "chai_result_shown", properties: { status: "done", output_kind: "video", result_count: 2 } },
      { name: "chai_result_action", properties: { action: "download" } },
      { name: "chai_result_paged", properties: { index: 1, count: 3 } },
      { name: "chai_result_info_opened", properties: {} },
      { name: "chai_side_panel_opened", properties: {} },
      { name: "chai_side_panel_closed", properties: { turn_count: 3 } },
      { name: "chai_side_panel_new_chat", properties: { turn_count: 2 } },
      { name: "chai_side_panel_tip_used", properties: { index: 1 } },
      { name: "chai_side_panel_page_context_toggled", properties: { on: false } },
    ]);
  });
});
