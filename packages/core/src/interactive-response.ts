/**
 * Interactive response: the elements an agent can place in its own reply
 * (a call-to-action button, approve or decline, a form, single or multiple
 * choice, choice cards, a media request), and the answer each one gives
 * back. Framework-neutral: the React, Vue and Svelte components draw these
 * shapes; this file holds the shapes and the wording every binding shares.
 *
 * Chai never calls the agent. The builder's agent returns an element as
 * JSON, the component draws it, and the answer comes back through a
 * callback for the builder to send on.
 */

/** A button that starts something the agent prepared. With `confirm`, it's approve or decline. */
export interface InteractiveAction {
  type: "action";
  /** The button's label, e.g. "Make the final logos". With `confirm`, the approve button's. */
  label: string;
  /** Ask before acting: adds a decline button beside the action. */
  confirm?: boolean;
  /** The decline button's label. Defaults to "Decline". */
  declineLabel?: string;
}

export type InteractiveFieldKind = "text" | "textarea" | "email" | "number" | "date" | "select";

export interface InteractiveFormField {
  /** The key the value comes back under. */
  id: string;
  label: string;
  /** Defaults to "text". */
  kind?: InteractiveFieldKind;
  placeholder?: string;
  required?: boolean;
  /** For `kind: "select"`. */
  options?: string[];
}

/** Several inputs the agent needs before it can act. */
export interface InteractiveForm {
  type: "form";
  fields: InteractiveFormField[];
  /** Defaults to "Send". */
  submitLabel?: string;
}

export interface InteractiveChoiceOption {
  id: string;
  label: string;
  /** A line under the label. */
  description?: string;
  /** Shown on the option's card when `display` is "cards". */
  image?: string;
}

/** Pick one (radio buttons) or several (checkboxes), as a list or as cards. */
export interface InteractiveChoice {
  type: "choice";
  options: InteractiveChoiceOption[];
  /** Checkboxes instead of radio buttons. */
  multiple?: boolean;
  /** "list" (default) or "cards", for options with an image. */
  display?: "list" | "cards";
  /** Adds an "Other" option that opens a text field. List only. */
  allowOther?: boolean;
  /** Defaults to "Other". */
  otherLabel?: string;
  /** Defaults to "Send". */
  submitLabel?: string;
}

/** The agent asks for a file in its reply. */
export interface InteractiveMediaRequest {
  type: "media";
  /** Which kinds the drop zone takes. Defaults to images. */
  accept?: Array<"image" | "video" | "audio">;
  /** How many files. Defaults to 1. */
  max?: number;
  /** A Skip button beside Send, with this label. Omit for no Skip. */
  skipLabel?: string;
  /** Defaults to "Send". */
  submitLabel?: string;
}

export type InteractiveElement = InteractiveAction | InteractiveForm | InteractiveChoice | InteractiveMediaRequest;

export type InteractiveAnswer =
  | { type: "action"; decision: "accepted" | "declined" }
  | { type: "form"; values: Record<string, string> }
  | { type: "choice"; selected: string[]; other?: string }
  /** An empty `files` means the person skipped. */
  | { type: "media"; files: Array<{ name: string; file?: File }> };

const DEFAULT_SUBMIT = "Send";
const DEFAULT_DECLINE = "Decline";
const DEFAULT_OTHER = "Other";

/** The option id an "Other" answer is stored under in `selected`. */
export const INTERACTIVE_OTHER_ID = "__other__";

export function interactiveSubmitLabel(element: InteractiveForm | InteractiveChoice | InteractiveMediaRequest): string {
  return element.submitLabel ?? DEFAULT_SUBMIT;
}

export function interactiveDeclineLabel(element: InteractiveAction): string {
  return element.declineLabel ?? DEFAULT_DECLINE;
}

export function interactiveOtherLabel(element: InteractiveChoice): string {
  return element.otherLabel ?? DEFAULT_OTHER;
}

/** The labels of what was chosen, with an "Other" answer as its typed text. */
function chosenLabels(element: InteractiveChoice, answer: { selected: string[]; other?: string }): string[] {
  return answer.selected.map((id) =>
    id === INTERACTIVE_OTHER_ID ? answer.other?.trim() || interactiveOtherLabel(element) : element.options.find((o) => o.id === id)?.label ?? id
  );
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The short label a locked element shows, so the chat keeps what the person
 * did: "You chose Vintage", "You clicked Not now", "You sent the form",
 * "You added sign.jpg", "You skipped this".
 */
export function interactiveAnswerLabel(element: InteractiveElement, answer: InteractiveAnswer): string {
  if (element.type === "action" && answer.type === "action") {
    return `You clicked ${answer.decision === "declined" ? interactiveDeclineLabel(element) : element.label}`;
  }
  if (element.type === "form" && answer.type === "form") return "You sent the form";
  if (element.type === "choice" && answer.type === "choice") return `You chose ${joinList(chosenLabels(element, answer))}`;
  if (element.type === "media" && answer.type === "media") {
    if (answer.files.length === 0) return "You skipped this";
    return answer.files.length === 1 ? `You added ${answer.files[0]!.name}` : `You added ${answer.files.length} files`;
  }
  return "Answered";
}

/**
 * The answer as the person's own chat message, for the thread: the action's
 * label, the chosen options, the form's values, or the files' names.
 */
export function interactiveAnswerText(element: InteractiveElement, answer: InteractiveAnswer): string {
  if (element.type === "action" && answer.type === "action") {
    return answer.decision === "declined" ? interactiveDeclineLabel(element) : element.label;
  }
  if (element.type === "form" && answer.type === "form") {
    return element.fields
      .filter((f) => answer.values[f.id]?.trim())
      .map((f) => `${f.label}: ${answer.values[f.id]!.trim()}`)
      .join("\n");
  }
  if (element.type === "choice" && answer.type === "choice") return joinList(chosenLabels(element, answer));
  if (element.type === "media" && answer.type === "media") {
    return answer.files.length === 0 ? element.skipLabel ?? "Skip" : answer.files.map((f) => f.name).join(", ");
  }
  return "";
}

/** Every required field has a value. */
export function interactiveFormReady(element: InteractiveForm, values: Record<string, string>): boolean {
  return element.fields.every((f) => !f.required || Boolean(values[f.id]?.trim()));
}

/** Something is picked, and a picked "Other" has text. */
export function interactiveChoiceReady(selected: string[], other: string): boolean {
  if (selected.length === 0) return false;
  return !selected.includes(INTERACTIVE_OTHER_ID) || other.trim().length > 0;
}

/** The next selection after the person clicks an option: replaces for single choice, toggles for multiple. */
export function nextInteractiveSelection(element: InteractiveChoice, selected: string[], id: string): string[] {
  if (!element.multiple) return [id];
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/** The `accept` attribute for the media request's file input. */
export function interactiveMediaAccept(element: InteractiveMediaRequest): string {
  return (element.accept ?? ["image"]).map((k) => `${k}/*`).join(",");
}

/** The kinds the drop zone takes, in words: "an image", "up to 3 images or videos". */
export function interactiveMediaHint(element: InteractiveMediaRequest): string {
  const kinds = element.accept ?? ["image"];
  const max = element.max ?? 1;
  if (max === 1) {
    const words = kinds.map((k) => (k === "image" ? "an image" : k === "video" ? "a video" : "an audio clip"));
    return `Drop ${words.join(" or ")} here, or select a file`;
  }
  const plural = kinds.map((k) => (k === "audio" ? "audio clips" : `${k}s`));
  return `Drop up to ${max} ${plural.join(" or ")} here, or select files`;
}

/**
 * Keeps the files the request takes (matching kind), the newest up to its
 * `max`: pass the files already picked followed by the new ones, and a new
 * pick replaces the oldest once the limit is reached.
 */
export function acceptInteractiveFiles<T extends { type: string }>(element: InteractiveMediaRequest, files: T[]): T[] {
  const kinds = element.accept ?? ["image"];
  return files.filter((f) => kinds.some((k) => f.type.startsWith(`${k}/`))).slice(-(element.max ?? 1));
}

// --- Wiring it to a model ----------------------------------------------------
//
// The builder's model decides when to ask the person something by calling a
// tool. These helpers describe that tool (its name, when to use it, and the
// JSON shape of its input) and check what the model sends back, so a
// malformed call falls back to plain text instead of breaking the page.
// Nothing here calls a model: the builder passes the tool to their own.

/** The tool's name, as the model sees it. */
export const INTERACTIVE_RESPONSE_TOOL_NAME = "ask_user";

const TOOL_DESCRIPTION = [
  "Ask the person something in your reply instead of in plain text, when you need a decision or details before you can act.",
  'Use "action" for a single button that starts something you prepared, with confirm: true when the action costs money, sends something or can\'t be undone (it adds a decline button).',
  'Use "choice" for picking from options you can list (multiple: true to allow several, display: "cards" when each option needs a description or an image, allowOther: true when the list may not cover every answer).',
  'Use "form" when you need several typed values at once, such as names, keys or dates.',
  'Use "media" to ask for an image, video or audio file.',
  "Ask one thing per call, and wait for the answer before asking the next.",
].join(" ");

/**
 * The tool's input as JSON Schema: `text` (your words above the element) and
 * `element`. One flat object, with `type` choosing which fields apply, so it
 * works with every provider's tool calling.
 */
export const interactiveResponseToolSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "element"],
  properties: {
    text: { type: "string", description: "Your words above the element: what you're asking and why." },
    element: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["action", "choice", "form", "media"] },
        label: { type: "string", description: 'action: the button label, e.g. "Create table".' },
        confirm: { type: "boolean", description: "action: add a decline button. Use for anything costly or irreversible." },
        declineLabel: { type: "string", description: 'action with confirm: the decline label, e.g. "Cancel".' },
        options: {
          type: "array",
          description: "choice: 2 to 12 options.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string", description: "A short line under the label." },
              image: { type: "string", description: "choice cards: an https image URL." },
            },
          },
        },
        multiple: { type: "boolean", description: "choice: allow several picks." },
        display: { type: "string", enum: ["list", "cards"], description: "choice: list (default) or cards." },
        allowOther: { type: "boolean", description: 'choice: add "Other" with a text field (lists only).' },
        fields: {
          type: "array",
          description: "form: 1 to 12 fields.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              kind: { type: "string", enum: ["text", "textarea", "email", "number", "date", "select"] },
              placeholder: { type: "string" },
              required: { type: "boolean" },
              options: { type: "array", items: { type: "string" }, description: "select: the choices." },
            },
          },
        },
        accept: {
          type: "array",
          items: { type: "string", enum: ["image", "video", "audio"] },
          description: "media: which kinds of file. Defaults to images.",
        },
        max: { type: "integer", minimum: 1, maximum: 10, description: "media: how many files. Defaults to 1." },
        skipLabel: { type: "string", description: 'media: a Skip button with this label, e.g. "Skip".' },
        submitLabel: { type: "string", description: 'choice, form or media: the send button\'s label. Defaults to "Send".' },
      },
    },
  },
} as const;

/**
 * The tool in the shape a provider's API takes: `"openai"` for the Chat
 * Completions `tools` array (also OpenRouter, Vercel AI Gateway and most
 * others), `"anthropic"` for the Messages API.
 */
export function interactiveResponseTool(format: "openai" | "anthropic" = "openai") {
  if (format === "anthropic") {
    return { name: INTERACTIVE_RESPONSE_TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: interactiveResponseToolSchema };
  }
  return {
    type: "function" as const,
    function: { name: INTERACTIVE_RESPONSE_TOOL_NAME, description: TOOL_DESCRIPTION, parameters: interactiveResponseToolSchema },
  };
}

const MAX_ITEMS = 12;
const str = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
/** Only https and inline images: a model-supplied URL shouldn't load from anywhere else. */
const imageUrl = (v: unknown): string | undefined => {
  const s = str(v, 2000);
  return s && (/^https:\/\//i.test(s) || /^data:image\//i.test(s)) ? s : undefined;
};
const FIELD_KINDS: InteractiveFieldKind[] = ["text", "textarea", "email", "number", "date", "select"];
const MEDIA_KINDS = ["image", "video", "audio"] as const;

/** Drops undefined values, so a checked element holds only what was given. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Items with a unique, non-empty id and label, at most 12. */
function uniqueItems<T extends { id: string; label: string }>(list: unknown, map: (o: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = map(raw as Record<string, unknown>);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

function parseElement(e: Record<string, unknown>): InteractiveElement | null {
  switch (e.type) {
    case "action": {
      const label = str(e.label, 60);
      if (!label) return null;
      return compact<InteractiveAction>({ type: "action", label, confirm: bool(e.confirm), declineLabel: str(e.declineLabel, 60) });
    }
    case "choice": {
      const options = uniqueItems(e.options, (o) => {
        const id = str(o.id, 80);
        const label = str(o.label, 120);
        return id && label ? compact({ id, label, description: str(o.description), image: imageUrl(o.image) }) : null;
      });
      if (options.length < 2) return null;
      return compact<InteractiveChoice>({
        type: "choice",
        options,
        multiple: bool(e.multiple),
        display: e.display === "cards" ? ("cards" as const) : e.display === "list" ? ("list" as const) : undefined,
        allowOther: bool(e.allowOther),
        submitLabel: str(e.submitLabel, 60),
      });
    }
    case "form": {
      const fields = uniqueItems(e.fields, (f) => {
        const id = str(f.id, 80);
        const label = str(f.label, 120);
        if (!id || !label) return null;
        const kind = FIELD_KINDS.includes(f.kind as InteractiveFieldKind) ? (f.kind as InteractiveFieldKind) : undefined;
        const options = Array.isArray(f.options)
          ? f.options.map((o) => str(o, 120)).filter((o): o is string => Boolean(o)).slice(0, MAX_ITEMS)
          : undefined;
        if (kind === "select" && !options?.length) return null;
        return compact({ id, label, kind, placeholder: str(f.placeholder), required: bool(f.required), options: kind === "select" ? options : undefined });
      });
      if (fields.length === 0) return null;
      return compact<InteractiveForm>({ type: "form", fields, submitLabel: str(e.submitLabel, 60) });
    }
    case "media": {
      const accept = Array.isArray(e.accept) ? MEDIA_KINDS.filter((k) => (e.accept as unknown[]).includes(k)) : [];
      const max = typeof e.max === "number" && Number.isFinite(e.max) ? Math.min(10, Math.max(1, Math.floor(e.max))) : undefined;
      return compact<InteractiveMediaRequest>({
        type: "media",
        accept: accept.length ? accept : undefined,
        max,
        skipLabel: str(e.skipLabel, 60),
        submitLabel: str(e.submitLabel, 60),
      });
    }
    default:
      return null;
  }
}

/**
 * Checks a model's `ask_user` call (its arguments, as an object or a JSON
 * string) and returns `{ text, element }` ready for `InteractiveResponse`,
 * or `null` when it can't be drawn, so the app can show the text alone.
 * Unknown fields are dropped, text is trimmed and capped, lists are capped
 * at 12, and images must be https.
 */
export function parseInteractiveResponse(input: unknown): { text: string; element: InteractiveElement } | null {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { text, element } = value as { text?: unknown; element?: unknown };
  if (!element || typeof element !== "object") return null;
  const parsed = parseElement(element as Record<string, unknown>);
  if (!parsed) return null;
  return { text: str(text, 2000) ?? "", element: parsed };
}
