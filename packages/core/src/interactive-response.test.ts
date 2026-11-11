import { describe, expect, it } from "vitest";
import {
  INTERACTIVE_OTHER_ID,
  INTERACTIVE_RESPONSE_TOOL_NAME,
  acceptInteractiveFiles,
  interactiveAnswerLabel,
  interactiveAnswerText,
  interactiveChoiceReady,
  interactiveDeclineLabel,
  interactiveFormReady,
  interactiveMediaAccept,
  interactiveMediaHint,
  interactiveOtherLabel,
  interactiveResponseTool,
  interactiveResponseToolSchema,
  interactiveSubmitLabel,
  nextInteractiveSelection,
  parseInteractiveResponse,
  type InteractiveAction,
  type InteractiveChoice,
  type InteractiveForm,
  type InteractiveMediaRequest,
} from "./interactive-response.js";

const action: InteractiveAction = { type: "action", label: "Create table" };
const confirm: InteractiveAction = { type: "action", label: "Create table", confirm: true, declineLabel: "Cancel" };
const choice: InteractiveChoice = {
  type: "choice",
  options: [
    { id: "a", label: "Slack" },
    { id: "b", label: "PagerDuty" },
    { id: "c", label: "Email" },
  ],
};
const multi: InteractiveChoice = { ...choice, multiple: true, allowOther: true };
const form: InteractiveForm = {
  type: "form",
  fields: [
    { id: "name", label: "Table name", required: true },
    { id: "sort", label: "Sort key" },
  ],
};
const media: InteractiveMediaRequest = { type: "media", skipLabel: "Skip" };

describe("labels and defaults", () => {
  it("falls back to Send, Decline and Other", () => {
    expect(interactiveSubmitLabel(form)).toBe("Send");
    expect(interactiveSubmitLabel({ ...form, submitLabel: "Continue" })).toBe("Continue");
    expect(interactiveDeclineLabel(action)).toBe("Decline");
    expect(interactiveDeclineLabel(confirm)).toBe("Cancel");
    expect(interactiveOtherLabel(choice)).toBe("Other");
    expect(interactiveOtherLabel({ ...choice, otherLabel: "Something else" })).toBe("Something else");
  });
});

describe("interactiveAnswerLabel", () => {
  it("says which button was clicked", () => {
    expect(interactiveAnswerLabel(action, { type: "action", decision: "accepted" })).toBe("You clicked Create table");
    expect(interactiveAnswerLabel(confirm, { type: "action", decision: "declined" })).toBe("You clicked Cancel");
  });

  it("lists the choices, with Other as its text", () => {
    expect(interactiveAnswerLabel(choice, { type: "choice", selected: ["b"] })).toBe("You chose PagerDuty");
    expect(interactiveAnswerLabel(multi, { type: "choice", selected: ["a", "c", INTERACTIVE_OTHER_ID], other: "Teams" })).toBe(
      "You chose Slack, Email and Teams"
    );
    expect(interactiveAnswerLabel(multi, { type: "choice", selected: [INTERACTIVE_OTHER_ID] })).toBe("You chose Other");
    expect(interactiveAnswerLabel(choice, { type: "choice", selected: ["gone"] })).toBe("You chose gone");
  });

  it("covers forms and files", () => {
    expect(interactiveAnswerLabel(form, { type: "form", values: {} })).toBe("You sent the form");
    expect(interactiveAnswerLabel(media, { type: "media", files: [] })).toBe("You skipped this");
    expect(interactiveAnswerLabel(media, { type: "media", files: [{ name: "a.png" }] })).toBe("You added a.png");
    expect(interactiveAnswerLabel(media, { type: "media", files: [{ name: "a.png" }, { name: "b.png" }] })).toBe(
      "You added 2 files"
    );
  });

  it("has a neutral label when the answer doesn't match the element", () => {
    expect(interactiveAnswerLabel(form, { type: "action", decision: "accepted" })).toBe("Answered");
  });
});

describe("interactiveAnswerText", () => {
  it("is the button's label", () => {
    expect(interactiveAnswerText(action, { type: "action", decision: "accepted" })).toBe("Create table");
    expect(interactiveAnswerText(confirm, { type: "action", decision: "declined" })).toBe("Cancel");
  });

  it("lists filled form values, one per line", () => {
    expect(interactiveAnswerText(form, { type: "form", values: { name: " user_sessions ", sort: " " } })).toBe(
      "Table name: user_sessions"
    );
  });

  it("names the choices and the files", () => {
    expect(interactiveAnswerText(choice, { type: "choice", selected: ["a", "b"] })).toBe("Slack and PagerDuty");
    expect(interactiveAnswerText(media, { type: "media", files: [] })).toBe("Skip");
    expect(interactiveAnswerText({ type: "media" }, { type: "media", files: [] })).toBe("Skip");
    expect(interactiveAnswerText(media, { type: "media", files: [{ name: "a.png" }, { name: "b.png" }] })).toBe("a.png, b.png");
    expect(interactiveAnswerText(media, { type: "action", decision: "accepted" })).toBe("");
  });
});

describe("readiness and selection", () => {
  it("needs every required field", () => {
    expect(interactiveFormReady(form, {})).toBe(false);
    expect(interactiveFormReady(form, { name: "  " })).toBe(false);
    expect(interactiveFormReady(form, { name: "user_sessions" })).toBe(true);
  });

  it("needs a pick, and text for Other", () => {
    expect(interactiveChoiceReady([], "")).toBe(false);
    expect(interactiveChoiceReady(["a"], "")).toBe(true);
    expect(interactiveChoiceReady([INTERACTIVE_OTHER_ID], " ")).toBe(false);
    expect(interactiveChoiceReady([INTERACTIVE_OTHER_ID], "Teams")).toBe(true);
  });

  it("replaces for single choice and toggles for multiple", () => {
    expect(nextInteractiveSelection(choice, ["a"], "b")).toEqual(["b"]);
    expect(nextInteractiveSelection(multi, ["a"], "b")).toEqual(["a", "b"]);
    expect(nextInteractiveSelection(multi, ["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("media requests", () => {
  it("builds the accept attribute and the hint", () => {
    expect(interactiveMediaAccept(media)).toBe("image/*");
    expect(interactiveMediaAccept({ type: "media", accept: ["video", "audio"] })).toBe("video/*,audio/*");
    expect(interactiveMediaHint(media)).toBe("Drop an image here, or select a file");
    expect(interactiveMediaHint({ type: "media", accept: ["video", "audio"] })).toBe(
      "Drop a video or an audio clip here, or select a file"
    );
    expect(interactiveMediaHint({ type: "media", accept: ["image", "audio"], max: 3 })).toBe(
      "Drop up to 3 images or audio clips here, or select files"
    );
  });

  it("keeps the newest matching files up to the limit", () => {
    const files = [{ type: "image/png" }, { type: "application/pdf" }, { type: "image/jpeg" }];
    expect(acceptInteractiveFiles(media, files)).toEqual([{ type: "image/jpeg" }]);
    expect(acceptInteractiveFiles({ type: "media", max: 5 }, files)).toEqual([{ type: "image/png" }, { type: "image/jpeg" }]);
  });
});

describe("interactiveResponseTool", () => {
  it("is ask_user in OpenAI's shape by default", () => {
    const tool = interactiveResponseTool();
    expect(tool).toMatchObject({ type: "function", function: { name: INTERACTIVE_RESPONSE_TOOL_NAME } });
    expect("function" in tool && tool.function.parameters).toBe(interactiveResponseToolSchema);
  });

  it("is ask_user in Anthropic's shape", () => {
    const tool = interactiveResponseTool("anthropic");
    expect(tool).toMatchObject({ name: "ask_user", input_schema: interactiveResponseToolSchema });
    expect("description" in tool && tool.description).toMatch(/confirm: true/);
  });

  it("names every element type in the schema", () => {
    expect(interactiveResponseToolSchema.properties.element.properties.type.enum).toEqual(["action", "choice", "form", "media"]);
  });
});

describe("parseInteractiveResponse", () => {
  it("accepts a valid call, as an object or a JSON string", () => {
    const call = { text: " Create it? ", element: { type: "action", label: "Create table", confirm: true, declineLabel: "Cancel" } };
    const expected = { text: "Create it?", element: { type: "action", label: "Create table", confirm: true, declineLabel: "Cancel" } };
    expect(parseInteractiveResponse(call)).toEqual(expected);
    expect(parseInteractiveResponse(JSON.stringify(call))).toEqual(expected);
  });

  it("returns null for anything it can't draw", () => {
    expect(parseInteractiveResponse("not json")).toBeNull();
    expect(parseInteractiveResponse(null)).toBeNull();
    expect(parseInteractiveResponse({ text: "Hi" })).toBeNull();
    expect(parseInteractiveResponse({ element: { type: "slider" } })).toBeNull();
    expect(parseInteractiveResponse({ element: { type: "action" } })).toBeNull();
    expect(parseInteractiveResponse({ element: { type: "choice", options: [{ id: "a", label: "A" }] } })).toBeNull();
    expect(parseInteractiveResponse({ element: { type: "choice", options: "a,b" } })).toBeNull();
    expect(parseInteractiveResponse({ element: { type: "form", fields: [] } })).toBeNull();
  });

  it("cleans a choice: unique ids, safe images, known display, at most 12", () => {
    const options = [
      { id: "a", label: "A", image: "https://x.test/a.png", extra: 1 },
      { id: "a", label: "Duplicate" },
      { id: "b", label: "B", image: "http://x.test/b.png", description: " Line " },
      { id: "c", label: "C", image: "data:image/png;base64,AAAA" },
      { id: "", label: "No id" },
      "junk",
      ...Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })),
    ];
    const parsed = parseInteractiveResponse({
      element: { type: "choice", options, multiple: true, display: "cards", allowOther: "yes", submitLabel: "Pick" },
    });
    expect(parsed?.text).toBe("");
    expect(parsed?.element).toMatchObject({ type: "choice", multiple: true, display: "cards", submitLabel: "Pick" });
    const el = parsed!.element as InteractiveChoice;
    expect(el.allowOther).toBeUndefined();
    expect(el.options).toHaveLength(12);
    expect(el.options.slice(0, 3)).toEqual([
      { id: "a", label: "A", image: "https://x.test/a.png" },
      { id: "b", label: "B", description: "Line" },
      { id: "c", label: "C", image: "data:image/png;base64,AAAA" },
    ]);
    expect(parseInteractiveResponse({ element: { type: "choice", options: options.slice(0, 3), display: "list" } })?.element).toMatchObject({
      display: "list",
    });
    expect((parseInteractiveResponse({ element: { type: "choice", options: options.slice(0, 3), display: "grid" } })?.element as InteractiveChoice).display).toBeUndefined();
  });

  it("cleans a form: known kinds, selects need options", () => {
    const parsed = parseInteractiveResponse({
      element: {
        type: "form",
        submitLabel: "Continue",
        fields: [
          { id: "name", label: "Table name", required: true, placeholder: "user_sessions" },
          { id: "provider", label: "Cloud provider", kind: "select", options: ["AWS", "", 3, "Azure"] },
          { id: "empty", label: "Broken select", kind: "select", options: [] },
          { id: "when", label: "Start", kind: "calendar" },
          { id: "notes", label: "Notes", kind: "textarea", options: ["ignored"] },
        ],
      },
    });
    expect(parsed?.element).toEqual({
      type: "form",
      submitLabel: "Continue",
      fields: [
        { id: "name", label: "Table name", required: true, placeholder: "user_sessions" },
        { id: "provider", label: "Cloud provider", kind: "select", options: ["AWS", "Azure"] },
        { id: "when", label: "Start" },
        { id: "notes", label: "Notes", kind: "textarea" },
      ],
    });
  });

  it("cleans a media request: known kinds, max between 1 and 10", () => {
    expect(parseInteractiveResponse({ element: { type: "media", accept: ["image", "pdf"], max: 40, skipLabel: "Skip" } })?.element).toEqual({
      type: "media",
      accept: ["image"],
      max: 10,
      skipLabel: "Skip",
    });
    expect(parseInteractiveResponse({ element: { type: "media", accept: ["pdf"], max: 0.4 } })?.element).toEqual({ type: "media", max: 1 });
    expect(parseInteractiveResponse({ element: { type: "media", max: "3" } })?.element).toEqual({ type: "media" });
  });
});
