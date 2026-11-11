import { createComponent } from "@lit/react";
import * as React from "react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { MdFab } from "@material/web/fab/fab.js";
import {
  DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  isMediaAnalyzerAtCap,
  mediaAnalyzerEvents,
  mediaAnalyzerModelSections,
  nextMediaAnalyzerAttachments,
  PROMPT_LENGTH_HINT,
  readMediaFiles,
  replacedNote,
  SUGGESTED_ANALYSIS_MODELS,
} from "@chai-ui/core";
import type { ChaiEvent, ModelOption, MediaKind, MediaAnalysisPromptLength } from "@chai-ui/core";
import { SearchMenu } from "./primitives/SearchMenu.js";
import { ArrowForwardIcon, MixedMediaIcon, StopIcon } from "./icons.js";
import type { MediaAnalyzerAttachment, MediaAnalyzerSubmitPayload } from "@chai-ui/core";

export {
  DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  isMediaAnalyzerAtCap,
  nextMediaAnalyzerAttachments,
  type MediaAnalyzerAttachment,
  type MediaAnalyzerSubmitPayload,
} from "@chai-ui/core";

/** See primitives/Toggle.tsx for why `createComponent` is used instead of raw JSX on custom-element tags. */
const MdFabElement = createComponent({
  react: React,
  tagName: "md-fab",
  elementClass: MdFab,
  events: { onClick: "click" },
});

export interface MediaAnalyzerProps {
  attachments: MediaAnalyzerAttachment[];
  onAttachmentsChange: (next: MediaAnalyzerAttachment[]) => void;
  onUnsupportedFile?: (fileName: string) => void;
  maxAttachmentsByKind?: Record<MediaKind, number>;
  /** Fallback roster for a kind `modelsByKind` doesn't list. Optional. */
  models?: ModelOption[];
  /**
   * Per-kind rosters — once a kind is known, only that kind's models show.
   * Before that, all three show as separate sections (reference: Figma "06
   * Composer from Media Analysis"). Defaults to Chai's suggested OpenRouter
   * models (`SUGGESTED_ANALYSIS_MODELS`); pass your own to replace them.
   */
  modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
  /**
   * The picked model. While `autoSelectModel` is on it's `null` until a
   * submit routes, then the routed model, shown by name on the trigger.
   */
  modelId: string | null;
  /**
   * Fires from a row click, with `null` when auto-select turns on (clearing
   * the pick until routing chooses one), and from `useMediaAnalyzer` when
   * wired to it, with the routed model.
   */
  onModelChange: (id: string | null) => void;
  /**
   * A toggle rendered *inside* the "Select model" menu itself (reference:
   * the design mock) — the same pattern Composer bar's
   * `showAutoSelectToggle` now uses. Turning
   * this on (or attaching different-kind media while it's already on)
   * makes `MediaAnalyzer` itself pick a model via `onModelChange` — see
   * that prop's own doc comment.
   */
  autoSelectModel: boolean;
  onAutoSelectModelChange: (next: boolean) => void;
  /**
   * `null` until a person actually picks one — the trigger shows the plain
   * "Prompt length" label for as long as this stays `null` (reference:
   * design review: defaulting this to "concise" pre-fills
   * a value a first-time visitor never chose and may not even understand
   * yet, unlike "Select model", which starts unlabeled the same way).
   * Resolve an actual default (e.g. "concise") only at submit time, not by
   * seeding this state with one up front.
   */
  promptLength: MediaAnalysisPromptLength | null;
  onPromptLengthChange: (value: MediaAnalysisPromptLength) => void;
  promptLengthOptions: { value: MediaAnalysisPromptLength; label: string }[];
  disabled?: boolean;
  submitting?: boolean;
  submitError?: string | null;
  onSubmit: (payload: MediaAnalyzerSubmitPayload) => void;
  /** Fires when the stop button is pressed while `submitting`. With it, submit turns into stop during an analysis (wire it to `useMediaAnalyzer`'s `cancel`); without it, submit is just disabled. */
  onAbort?: () => void;
  /**
   * Front-end analytics: what the person does in the analyzer (attach and
   * remove media, model, auto-select and prompt length picks, submit, stop)
   * and when an analysis finishes, one `ChaiEvent` each:
   * `onEvent={(e) => posthog.capture(e.name, e.properties)}`. No file names
   * or contents, only kinds and counts.
   */
  onEvent?: (event: ChaiEvent) => void;
}

export function MediaAnalyzer({
  attachments,
  onAttachmentsChange,
  onUnsupportedFile,
  maxAttachmentsByKind = DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  models = [],
  modelsByKind = SUGGESTED_ANALYSIS_MODELS,
  modelId,
  onModelChange,
  autoSelectModel,
  onAutoSelectModelChange,
  promptLength,
  onPromptLengthChange,
  promptLengthOptions,
  disabled,
  submitting,
  submitError,
  onSubmit,
  onAbort,
  onEvent,
}: MediaAnalyzerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const kind = attachments[0]?.kind;
  const atCap = isMediaAnalyzerAtCap(attachments, maxAttachmentsByKind);
  // A count, not a boolean: `dragenter`/`dragleave` fire for every child
  // element the pointer crosses too (the icon, the hint text, the chip),
  // not just the dropzone's own boundary — a plain boolean flickers off
  // the moment a drag crosses from the container onto one of those
  // children. Active for as long as this is > 0; both drag handlers below
  // clamp at 0 so a stray extra `dragleave` can't go negative.
  const [dragDepth, setDragDepth] = useState(0);
  // What the last attach replaced (one kind per analysis), shown until the
  // attachments change some other way.
  const [replaced, setReplaced] = useState<{ note: string; for: MediaAnalyzerAttachment[] } | null>(null);
  const isDragActive = dragDepth > 0;

  /** Reads every file first, then applies them in drop order and commits once. */
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const { media, unsupported } = await readMediaFiles(fileList);
    unsupported.forEach((name) => onUnsupportedFile?.(name));
    onEvent?.(mediaAnalyzerEvents.mediaAttached(media.length, unsupported.length));
    if (media.length === 0) return;
    const next = media.reduce((acc, m) => nextMediaAnalyzerAttachments(acc, m, maxAttachmentsByKind), attachments);
    const note = replacedNote(attachments, next);
    setReplaced(note ? { note, for: next } : null);
    onAttachmentsChange(next);
  }

  function handleRemove(id: string) {
    const next = attachments.filter((a) => a.id !== id);
    onEvent?.(mediaAnalyzerEvents.mediaRemoved(next.length));
    onAttachmentsChange(next);
  }

  // "Finished" when an analysis stops running: done, or failed (`submitError`
  // set). Not after Stop, which reports its own event.
  const wasSubmitting = useRef(submitting);
  const stoppedRef = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !submitting) {
      if (!stoppedRef.current) onEvent?.(mediaAnalyzerEvents.finished(submitError ? "error" : "done"));
      stoppedRef.current = false;
    }
    wasSubmitting.current = submitting;
  }, [submitting, submitError, onEvent]);

  const sections = mediaAnalyzerModelSections(kind, modelsByKind, models);
  // Looked up across every section (not just `modelOptions`, which is empty
  // until a kind is known) — a model picked while the menu still shows all
  // three kinds' sections (no attachment yet) must still resolve to a real
  // label on the trigger once the panel closes.
  const selectedModel = sections.flatMap((s) => s.options).find((m) => m.id === modelId);

  // Auto-select chooses at submit (`useMediaAnalyzer` routes with the
  // reasoning model, using the media itself). Turning it on clears the
  // current pick, so the trigger says what will happen until it does.
  const wasAutoSelect = useRef(autoSelectModel);
  useEffect(() => {
    if (autoSelectModel && !wasAutoSelect.current) onModelChange(null);
    wasAutoSelect.current = autoSelectModel;
  }, [autoSelectModel, onModelChange]);
  const modelTriggerLabel = selectedModel?.label ?? (autoSelectModel ? "Auto-select model" : "Select model");

  const selectedLength = promptLengthOptions.find((o) => o.value === promptLength);
  const hasContent = attachments.length > 0;
  const isSubmitDisabled = disabled || !hasContent;
  const showStop = Boolean(submitting && onAbort);

  return (
    <div className="chai-media-analyzer">
      <div
        className={`chai-media-analyzer__dropzone${atCap ? " chai-media-analyzer__dropzone--disabled" : ""}${
          isDragActive ? " chai-media-analyzer__dropzone--drag-active" : ""
        }`}
        onDragEnter={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragDepth((d) => d + 1);
        }}
        onDragLeave={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragDepth((d) => Math.max(0, d - 1));
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragDepth(0);
          if (disabled) return;
          handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="chai-media-analyzer__dropzone-icon" aria-hidden="true">
          <MixedMediaIcon />
        </span>
        <p className="chai-media-analyzer__dropzone-hint">
          {/* `atCap` is only ever true for image (see its own doc comment) — no need to branch on `kind` here. */}
          {atCap ? "Maximum images added" : "Add media to convert to prompt"}
        </p>
        <button
          type="button"
          className="chai-chip-button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Select files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          hidden
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="chai-media-analyzer__thumbnails">
          {attachments.map((a) => (
            <MediaAnalyzerThumbnail key={a.id} attachment={a} onRemove={() => handleRemove(a.id)} />
          ))}
        </div>
      )}

      {replaced && replaced.for === attachments && (
        <p className="chai-media-analyzer__note" role="status">
          {replaced.note}
        </p>
      )}

      {submitError && (
        <p className="chai-media-analyzer__error" role="alert">
          {submitError}
        </p>
      )}

      <div className="chai-media-analyzer__controls">
        <div className="chai-media-analyzer__controls-start">
          <SearchMenu
            options={sections.length === 1 ? sections[0]!.options : undefined}
            sections={sections.length > 1 ? sections : undefined}
            toggleHeader={{
              label: "Auto-select model",
              value: autoSelectModel,
              onChange: (on) => {
                onEvent?.(mediaAnalyzerEvents.autoSelectToggled(on));
                onAutoSelectModelChange(on);
              },
            }}
            value={modelId}
            triggerLabel={modelTriggerLabel}
            menuLabel="Select model"
            onSelect={(opt) => {
              onEvent?.(mediaAnalyzerEvents.modelPicked(kind, opt.id));
              onModelChange(opt.id);
            }}
            searchable={false}
            triggerVariant="text"
            disabled={disabled}
            panelWidth={320}
          />
          <SearchMenu
            options={promptLengthOptions.map((o) => ({
              id: o.value,
              label: o.label,
              // Clarifying suffix shown only in the list itself, never on
              // the trigger (design spec: "don't use the
              // longer label as the replacement when a value is selected").
              rowLabel: `${o.label} (${PROMPT_LENGTH_HINT[o.value]})`,
            }))}
            value={promptLength}
            triggerLabel={selectedLength?.label ?? "Prompt length"}
            menuLabel="Prompt length"
            onSelect={(opt) => {
              onEvent?.(mediaAnalyzerEvents.promptLengthPicked(opt.id as MediaAnalysisPromptLength));
              onPromptLengthChange(opt.id as MediaAnalysisPromptLength);
            }}
            searchable={false}
            triggerVariant="text"
            disabled={disabled}
          />
        </div>

        {/* Same flat/unfilled-until-ready submit treatment as Composer's own
            FAB — see that component's own long comment on `chai-composer__submit`
            for why the overrides below exist; not repeated here verbatim. */}
        <MdFabElement
          className="chai-media-analyzer__submit"
          size="small"
          variant="secondary"
          label=""
          data-ready={showStop || !isSubmitDisabled || undefined}
          data-error={Boolean(submitError) || undefined}
          data-stop={showStop || undefined}
          {...({
            ariaLabel: showStop ? "Stop" : submitError ? "Retry" : "Analyze media",
            ariaDisabled: showStop ? "false" : submitting ? "true" : isSubmitDisabled ? "true" : "false",
          } as Record<string, unknown>)}
          onClick={() => {
            if (showStop) {
              stoppedRef.current = true;
              onEvent?.(mediaAnalyzerEvents.stopped());
              onAbort?.();
            } else if (!isSubmitDisabled && !submitting) {
              onEvent?.(mediaAnalyzerEvents.submitted(kind, attachments.length, autoSelectModel, promptLength, Boolean(submitError)));
              onSubmit({
                attachments,
                modelId,
                autoSelectModel,
                models: kind ? (modelsByKind[kind] ?? models) : [],
                promptLength,
              });
            }
          }}
        >
          <span slot="icon">{showStop ? <StopIcon /> : <ArrowForwardIcon />}</span>
        </MdFabElement>
      </div>
    </div>
  );
}

function MediaAnalyzerThumbnail({
  attachment,
  onRemove,
}: {
  attachment: MediaAnalyzerAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="chai-media-analyzer__thumb">
      {attachment.kind === "image" ? (
        <img className="chai-media-analyzer__thumb-img" src={attachment.src} alt="" />
      ) : (
        <span className="chai-media-analyzer__thumb-icon">
          {attachment.kind === "video" ? <VideoIcon /> : <AudioIcon />}
        </span>
      )}
      <button
        type="button"
        className="chai-media-analyzer__thumb-remove"
        onClick={onRemove}
        aria-label={`Remove ${attachment.name ?? attachment.kind}`}
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

// --- Icons ---------------------------------------------------------------
// Same "trace and inline as a currentColor component" convention Composer.tsx
// documents — icons aren't shared across files yet in this codebase.

/**
 * A stroked X, not the filled-path Material Symbols "close" glyph the rest
 * of this codebase traces (reference: Composer.tsx's own `CloseIcon`) —
 * that one read as too thin/faint at the small size a thumbnail's remove
 * badge needs (design review: "so small it's not visible...
 * needs to be bold or strong"). `strokeWidth` is what actually controls
 * boldness here, so it's a real lever if it ever needs to go bolder still.
 */
function RemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9m0-9-9 9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

