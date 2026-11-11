import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  acceptInteractiveFiles,
  interactiveResponseEvents,
  interactiveAnswerLabel,
  interactiveChoiceReady,
  interactiveDeclineLabel,
  interactiveFormReady,
  interactiveMediaAccept,
  interactiveMediaHint,
  interactiveOtherLabel,
  interactiveSubmitLabel,
  nextInteractiveSelection,
  INTERACTIVE_OTHER_ID,
  type ChaiEvent,
  type InteractiveAction,
  type InteractiveAnswer,
  type InteractiveChoice,
  type InteractiveElement,
  type InteractiveForm,
  type InteractiveMediaRequest,
} from "@chai-ui/core";
import { CheckIcon, CloseSymbolIcon, MixedMediaIcon } from "./icons.js";
import { SearchMenu } from "./primitives/SearchMenu.js";

export interface InteractiveResponseProps {
  /** The agent's words above the element. */
  text?: ReactNode;
  /** What to draw: an action, a form, a choice or a media request. */
  element: InteractiveElement;
  /**
   * The answer, once there is one. Passing it locks the element (for a
   * thread loaded from storage). Omit it and the component keeps its own,
   * locking after the person answers.
   */
  answer?: InteractiveAnswer | null;
  /** Called once, when the person answers. Send it on to your agent. */
  onAnswer?: (answer: InteractiveAnswer) => void;
  /** Analytics: the element shown, and answered (kinds and counts only). */
  onEvent?: (event: ChaiEvent) => void;
}

/**
 * An agent's reply with an interactive element in it: a call-to-action
 * button, approve or decline, a form, single or multiple choice, choice
 * cards, or a media request. It locks once answered and keeps a short
 * label of what the person did ("You declined").
 */
export function InteractiveResponse({ text, element, answer, onAnswer, onEvent }: InteractiveResponseProps) {
  const [own, setOwn] = useState<InteractiveAnswer | null>(null);
  const locked = answer ?? own;

  // Shown once, when it first appears unanswered (not when a saved thread reloads).
  const reportShown = useRef(!locked);
  useEffect(() => {
    if (!reportShown.current) return;
    reportShown.current = false;
    onEvent?.(interactiveResponseEvents.shown(element));
  });

  function submit(next: InteractiveAnswer) {
    if (locked) return;
    setOwn(next);
    onEvent?.(interactiveResponseEvents.answered(element, next));
    onAnswer?.(next);
  }

  return (
    <div className={`chai-interactive${locked ? " chai-interactive--locked" : ""}`}>
      {text && <div className="chai-interactive__text">{text}</div>}
      <div className="chai-interactive__body">
        {element.type === "action" && <ActionBody element={element} locked={locked} onSubmit={submit} />}
        {element.type === "form" && <FormBody element={element} locked={locked} onSubmit={submit} />}
        {element.type === "choice" && <ChoiceBody element={element} locked={locked} onSubmit={submit} />}
        {element.type === "media" && <MediaBody element={element} locked={locked} onSubmit={submit} />}
        {locked && (
          <p className="chai-interactive__answered" role="status">
            <CheckIcon />
            {interactiveAnswerLabel(element, locked)}
          </p>
        )}
      </div>
    </div>
  );
}

interface BodyProps<E> {
  element: E;
  locked: InteractiveAnswer | null;
  onSubmit: (answer: InteractiveAnswer) => void;
}

function ActionBody({ element, locked, onSubmit }: BodyProps<InteractiveAction>) {
  const decision = locked?.type === "action" ? locked.decision : null;
  return (
    <div className="chai-interactive__actions">
      {element.confirm && (
        <button
          type="button"
          className={`chai-btn chai-btn--outlined${decision === "declined" ? " chai-interactive__picked" : ""}`}
          disabled={Boolean(locked)}
          onClick={() => onSubmit({ type: "action", decision: "declined" })}
        >
          {interactiveDeclineLabel(element)}
        </button>
      )}
      <button
        type="button"
        className={`chai-btn chai-interactive__primary${decision === "accepted" ? " chai-interactive__picked" : ""}`}
        disabled={Boolean(locked)}
        onClick={() => onSubmit({ type: "action", decision: "accepted" })}
      >
        {element.label}
      </button>
    </div>
  );
}

function FormBody({ element, locked, onSubmit }: BodyProps<InteractiveForm>) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>({});
  const shown = locked?.type === "form" ? locked.values : values;
  const ready = interactiveFormReady(element, values);
  return (
    <form
      className="chai-interactive__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ type: "form", values });
      }}
    >
      {element.fields.map((field) => {
        const fieldId = `${id}-${field.id}`;
        const common = {
          id: fieldId,
          className: "chai-interactive__input",
          value: shown[field.id] ?? "",
          required: field.required,
          disabled: Boolean(locked),
          placeholder: locked ? undefined : field.placeholder,
          onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field.id]: e.target.value })),
        };
        return (
          <div key={field.id} className="chai-interactive__field">
            <label htmlFor={fieldId} className="chai-interactive__label">
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </label>
            {field.kind === "textarea" ? (
              <textarea {...common} rows={3} />
            ) : field.kind === "select" ? (
              // The same dropdown as the Composer's and Media analyzer's menus.
              <div className={`chai-interactive__select${shown[field.id] ? "" : " chai-interactive__select--empty"}`}>
                <SearchMenu
                  triggerId={fieldId}
                  options={(field.options ?? []).map((o) => ({ id: o, label: o }))}
                  value={shown[field.id] ?? null}
                  triggerLabel={shown[field.id] || (locked ? "" : field.placeholder || "Choose")}
                  menuLabel={field.label}
                  onSelect={(o) => setValues((v) => ({ ...v, [field.id]: o.id }))}
                  disabled={Boolean(locked)}
                  searchable={false}
                />
              </div>
            ) : (
              <input {...common} type={field.kind ?? "text"} />
            )}
          </div>
        );
      })}
      {!locked && (
        <div className="chai-interactive__actions">
          <button type="submit" className="chai-btn chai-interactive__primary" disabled={!ready}>
            {interactiveSubmitLabel(element)}
          </button>
        </div>
      )}
    </form>
  );
}

function ChoiceBody({ element, locked, onSubmit }: BodyProps<InteractiveChoice>) {
  const name = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const shownSelected = locked?.type === "choice" ? locked.selected : selected;
  const shownOther = locked?.type === "choice" ? locked.other ?? "" : other;
  const cards = element.display === "cards";
  const ready = interactiveChoiceReady(selected, other);
  const pick = (optionId: string) => setSelected((s) => nextInteractiveSelection(element, s, optionId));
  const send = () => {
    if (!ready) return;
    const answer: InteractiveAnswer = { type: "choice", selected };
    if (selected.includes(INTERACTIVE_OTHER_ID)) answer.other = other.trim();
    onSubmit(answer);
  };
  const otherOn = shownSelected.includes(INTERACTIVE_OTHER_ID);

  return (
    <div className="chai-interactive__choice">
      {cards ? (
        <div className="chai-interactive__cards" role="group">
          {element.options.map((o) => {
            const on = shownSelected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={`chai-interactive__card${on ? " chai-interactive__card--selected" : ""}`}
                aria-pressed={on}
                disabled={Boolean(locked)}
                onClick={() => pick(o.id)}
              >
                {o.image && <img src={o.image} alt="" className="chai-interactive__card-image" />}
                <span className="chai-interactive__card-label">{o.label}</span>
                {o.description && <span className="chai-interactive__description">{o.description}</span>}
                {on && (
                  <span className="chai-interactive__card-check" aria-hidden="true">
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="chai-interactive__options" role={element.multiple ? "group" : "radiogroup"}>
          {[
            ...element.options,
            ...(element.allowOther ? [{ id: INTERACTIVE_OTHER_ID, label: interactiveOtherLabel(element), description: undefined }] : []),
          ].map(
            (o) => (
              <label key={o.id} className="chai-interactive__option">
                <input
                  type={element.multiple ? "checkbox" : "radio"}
                  name={name}
                  checked={shownSelected.includes(o.id)}
                  // Locked without `disabled`: browsers gray out a disabled
                  // input, the chosen one included.
                  aria-disabled={locked ? true : undefined}
                  tabIndex={locked ? -1 : undefined}
                  onChange={() => {
                    if (!locked) pick(o.id);
                  }}
                />
                <span className="chai-interactive__option-text">
                  <span>{o.label}</span>
                  {o.description && <span className="chai-interactive__description">{o.description}</span>}
                </span>
              </label>
            )
          )}
          {element.allowOther && otherOn && (
            <input
              className="chai-interactive__input chai-interactive__other"
              aria-label={interactiveOtherLabel(element)}
              placeholder="Type your answer"
              value={shownOther}
              disabled={Boolean(locked)}
              autoFocus={!locked}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
          )}
        </div>
      )}
      {!locked && (
        <div className="chai-interactive__actions">
          <button type="button" className="chai-btn chai-interactive__primary" disabled={!ready} onClick={send}>
            {interactiveSubmitLabel(element)}
          </button>
        </div>
      )}
    </div>
  );
}

function MediaBody({ element, locked, onSubmit }: BodyProps<InteractiveMediaRequest>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const max = element.max ?? 1;
  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((current) => acceptInteractiveFiles(element, [...current, ...Array.from(list)]));
  };
  const shown = locked?.type === "media" ? locked.files.map((f) => f.name) : files.map((f) => f.name);

  return (
    <div className="chai-interactive__media">
      {!locked && (
        <div
          className={`chai-interactive__dropzone${dragging ? " chai-interactive__dropzone--drag-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
        >
          <span className="chai-interactive__dropzone-icon" aria-hidden="true">
            <MixedMediaIcon />
          </span>
          <span className="chai-interactive__dropzone-hint">{interactiveMediaHint(element)}</span>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={interactiveMediaAccept(element)}
            multiple={max > 1}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {shown.length > 0 && (
        <ul className="chai-interactive__files">
          {shown.map((fileName, i) => (
            <li key={`${fileName}-${i}`} className="chai-interactive__file">
              <span>{fileName}</span>
              {!locked && (
                <button
                  type="button"
                  className="chai-interactive__file-remove"
                  aria-label={`Remove ${fileName}`}
                  onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                >
                  <CloseSymbolIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <div className="chai-interactive__actions">
          {element.skipLabel && (
            <button
              type="button"
              className="chai-btn chai-btn--outlined"
              onClick={() => onSubmit({ type: "media", files: [] })}
            >
              {element.skipLabel}
            </button>
          )}
          <button
            type="button"
            className="chai-btn chai-interactive__primary"
            disabled={files.length === 0}
            onClick={() => onSubmit({ type: "media", files: files.map((file) => ({ name: file.name, file })) })}
          >
            {interactiveSubmitLabel(element)}
          </button>
        </div>
      )}
    </div>
  );
}
