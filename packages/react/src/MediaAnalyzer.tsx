import { createComponent } from "@lit/react";
import * as React from "react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { MdFab } from "@material/web/fab/fab.js";
import {
  DEFAULT_MAX_ATTACHMENTS_BY_KIND,
  isMediaAnalyzerAtCap,
  mediaAnalyzerModelSections,
  nextMediaAnalyzerAttachments,
  PROMPT_LENGTH_HINT,
  readMediaFiles,
  replacedNote,
  SUGGESTED_ANALYSIS_MODELS,
} from "@chai-ui/core";
import type { ModelOption, MediaKind, MediaAnalysisPromptLength } from "@chai-ui/core";
import { SearchMenu } from "./primitives/SearchMenu.js";
import { StopIcon } from "./icons.js";
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
    if (media.length === 0) return;
    const next = media.reduce((acc, m) => nextMediaAnalyzerAttachments(acc, m, maxAttachmentsByKind), attachments);
    const note = replacedNote(attachments, next);
    setReplaced(note ? { note, for: next } : null);
    onAttachmentsChange(next);
  }

  function handleRemove(id: string) {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  }

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
              onChange: onAutoSelectModelChange,
            }}
            value={modelId}
            triggerLabel={modelTriggerLabel}
            menuLabel="Select model"
            onSelect={(opt) => onModelChange(opt.id)}
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
            onSelect={(opt) => onPromptLengthChange(opt.id as MediaAnalysisPromptLength)}
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
            if (showStop) onAbort?.();
            else if (!isSubmitDisabled && !submitting) onSubmit({
              attachments,
              modelId,
              autoSelectModel,
              models: kind ? (modelsByKind[kind] ?? models) : [],
              promptLength,
            });
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

function ArrowForwardIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M686-450H160v-60h526L438-758l42-42 320 320-320 320-42-42 248-248Z" fill="currentColor" />
    </svg>
  );
}

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

/** Traced from the Figma "Mixed Media Icon" asset — the same icon FeaturedCatalogCards.tsx traces for the docs catalog card, reproduced here rather than imported since it's a docs-only file and this package can't depend on it. */
function MixedMediaIcon() {
  return (
    <svg viewBox="0 0 24.1904 24.3948" fill="none" aria-hidden="true">
      <path
        d="M2.90401 23.3661C3.05621 23.765 3.35538 24.0825 3.7464 24.2557C3.95634 24.3502 4.17678 24.3948 4.39985 24.3948C4.59404 24.3948 4.78561 24.3581 4.97194 24.2872L14.4167 20.6762C15.2407 20.3613 15.6554 19.4323 15.3405 18.6083L12.543 11.2918C12.3908 10.8929 12.0916 10.5753 11.7006 10.4021C11.3096 10.2289 10.8739 10.2158 10.4751 10.368L1.03027 13.9817C0.63138 14.1339 0.313842 14.433 0.14064 14.824C-0.0351869 15.2151 -0.045684 15.6507 0.106524 16.0496L2.90401 23.3661ZM0.859692 15.1442C0.948918 14.9448 1.109 14.7926 1.31107 14.7165L10.7559 11.1054C10.8503 11.0687 10.95 11.0503 11.0471 11.0503C11.16 11.0503 11.2728 11.074 11.3778 11.1212C11.5773 11.2104 11.7295 11.3705 11.8056 11.5752L13.9811 17.262L10.294 14.9474C9.92658 14.7165 9.48308 14.6718 9.07631 14.8293C8.66955 14.9841 8.37038 15.3122 8.24966 15.7294L7.76155 17.43L6.26308 16.4905C5.89568 16.2595 5.45218 16.2149 5.04542 16.3724C4.63865 16.5272 4.33949 16.8552 4.21877 17.2725L3.01685 21.4582L0.843947 15.7688C0.765218 15.5667 0.773091 15.3437 0.862317 15.1468L0.859692 15.1442ZM14.6057 18.8917C14.7657 19.3116 14.5558 19.7839 14.1359 19.944L4.69114 23.555C4.48907 23.6338 4.26601 23.6259 4.06919 23.5367C3.86974 23.4474 3.71753 23.2873 3.64143 23.0827L3.57845 22.9199L7.24194 21.5186L14.5453 18.7263L14.6083 18.8891L14.6057 18.8917ZM7.69594 20.503L9.00546 15.9446C9.05532 15.7662 9.18391 15.6271 9.35711 15.5615C9.42534 15.5352 9.4962 15.5221 9.56705 15.5221C9.67465 15.5221 9.78224 15.551 9.87672 15.6113L13.8945 18.1333L7.69857 20.503H7.69594ZM6.77482 20.8546L3.66505 22.0434L4.97456 17.4851C5.02442 17.3066 5.15301 17.1675 5.32622 17.1019C5.39445 17.0757 5.4653 17.0626 5.53616 17.0626C5.64375 17.0626 5.75135 17.0914 5.84582 17.1518L7.53586 18.212L6.77744 20.852L6.77482 20.8546Z"
        fill="currentColor"
      />
      <path
        d="M6.70667 15.8872C6.70667 15.8872 6.71716 15.8872 6.72241 15.8872C7.04782 15.882 7.34961 15.7534 7.57793 15.5198C7.80624 15.2863 7.92695 14.9819 7.92171 14.6565C7.91646 14.331 7.78787 14.0293 7.55431 13.8009C7.32075 13.5753 7.00846 13.4493 6.69092 13.4572C6.36551 13.4624 6.06372 13.591 5.8354 13.8246C5.60709 14.0581 5.48638 14.3625 5.49162 14.6879C5.49687 15.0134 5.62546 15.3152 5.85902 15.5435C6.08734 15.7665 6.38913 15.8872 6.70667 15.8872ZM6.70667 14.2444C6.81951 14.2444 6.92448 14.2864 7.00583 14.3652C7.08719 14.4439 7.13442 14.5515 7.13442 14.667C7.13442 14.7824 7.09243 14.89 7.01371 14.9714C6.93498 15.0527 6.82738 15.1 6.71191 15.1C6.5912 15.1 6.48885 15.058 6.4075 14.9792C6.32614 14.9005 6.27891 14.7929 6.27891 14.6775C6.27891 14.562 6.3209 14.4544 6.39962 14.373C6.47835 14.2917 6.58595 14.2444 6.70142 14.2444H6.70667Z"
        fill="currentColor"
      />
      <path
        d="M23.9034 19.6056C23.8981 19.5819 23.885 19.5636 23.8797 19.5399C23.8797 19.5137 23.8745 19.4901 23.8692 19.4638L22.7408 15.0026L22.2894 13.2181C22.2606 13.1052 22.1845 13.0107 22.0821 12.9609C21.9771 12.911 21.8564 12.9084 21.7515 12.953L16.6236 15.1994C16.4478 15.2755 16.3533 15.4697 16.4005 15.656L16.8519 17.4405C16.8519 17.4405 16.8572 17.451 16.8598 17.4589C16.8598 17.4668 16.8598 17.472 16.8624 17.4799L17.794 21.1644C17.4686 21.1565 17.1039 21.2562 16.7417 21.4662C15.8862 21.9569 15.3692 22.836 15.5372 23.5105C15.6106 23.8018 15.8048 24.0275 16.083 24.1456C16.23 24.2085 16.39 24.2374 16.5633 24.2374C16.8808 24.2374 17.2324 24.1351 17.5815 23.933C18.437 23.4422 18.954 22.5631 18.786 21.8887C18.7808 21.8651 18.7676 21.8467 18.7624 21.8231C18.7624 21.7968 18.7571 21.7732 18.7519 21.747L17.6969 17.5717L22.0926 15.6455L22.9114 18.8812C22.586 18.8734 22.2212 18.9731 21.859 19.183C21.0035 19.6738 20.4865 20.5529 20.6545 21.2274C20.728 21.5187 20.9222 21.7443 21.2004 21.8624C21.3473 21.9254 21.51 21.9543 21.6806 21.9543C21.9981 21.9543 22.3498 21.8519 22.6988 21.6499C23.5543 21.1591 24.0713 20.28 23.9007 19.6056H23.9034ZM21.5074 21.1355C21.4549 21.1145 21.4313 21.0856 21.4182 21.0332C21.3552 20.7812 21.6412 20.2144 22.2501 19.8654C22.4967 19.7236 22.7198 19.6685 22.8799 19.6685C22.9481 19.6685 23.0059 19.679 23.0505 19.6974C23.103 19.7184 23.1266 19.7473 23.1397 19.7997C23.2027 20.0517 22.9166 20.6185 22.3078 20.9676C21.9561 21.1696 21.6517 21.1985 21.5074 21.1355ZM17.5001 16.7976L17.2456 15.7872L21.6412 13.861L21.8958 14.8713L17.5001 16.7976ZM16.39 23.4186C16.3376 23.3976 16.3139 23.3688 16.3008 23.3163C16.2378 23.0644 16.5239 22.4975 17.1327 22.1485C17.3794 22.0068 17.6025 21.9517 17.7625 21.9517C17.8308 21.9517 17.8885 21.9622 17.9331 21.9805C17.9856 22.0015 18.0092 22.0304 18.0224 22.0829C18.0853 22.3348 17.7993 22.9016 17.1905 23.2507C16.8388 23.4527 16.5344 23.4816 16.39 23.4186Z"
        fill="currentColor"
      />
      <path
        d="M2.04571 7.49995C2.2504 7.54719 2.4551 7.57081 2.65192 7.57081C3.33686 7.57081 3.94831 7.30313 4.19237 6.85438C4.20549 6.83076 4.21074 6.80715 4.22124 6.78353C4.23436 6.76778 4.24748 6.75204 4.25798 6.73367L6.1737 3.23025L10.3489 4.6841L8.88721 7.35562C8.66677 7.15355 8.35973 6.99872 7.9897 6.91212C7.0817 6.70217 6.15796 6.98035 5.84042 7.55769C5.70133 7.80962 5.69083 8.09567 5.80893 8.36072C5.98475 8.75174 6.41251 9.0509 6.98723 9.18212C7.19192 9.22936 7.39662 9.25297 7.59344 9.25297C8.27837 9.25297 8.88983 8.9853 9.13389 8.53655C9.14701 8.51293 9.15226 8.48931 9.16276 8.46569C9.17588 8.44994 9.189 8.4342 9.1995 8.41583L11.2569 4.65261L12.081 3.14628C12.1361 3.04393 12.1439 2.92321 12.1019 2.81562C12.06 2.70802 11.9734 2.62404 11.8631 2.58468L6.94262 0.871025C6.76154 0.808042 6.55947 0.884146 6.46762 1.05472L5.6436 2.56106C5.6436 2.56106 5.63835 2.57156 5.63572 2.57681C5.6331 2.58206 5.62785 2.5873 5.62523 2.59255L3.94044 5.67083C3.72 5.46876 3.41296 5.31393 3.04294 5.22733C2.13494 5.01739 1.21119 5.29556 0.893651 5.8729C0.754565 6.12483 0.744067 6.41088 0.86216 6.67593C1.03799 7.06695 1.46574 7.36612 2.04046 7.49733L2.04571 7.49995ZM1.58909 6.2508C1.67306 6.09859 2.01422 5.94638 2.44722 5.94638C2.58106 5.94638 2.72277 5.96213 2.86973 5.99362C3.22926 6.0776 3.4497 6.24293 3.50743 6.37151C3.52843 6.41613 3.52056 6.445 3.50481 6.47649C3.39459 6.67593 2.84349 6.87538 2.22416 6.73367C1.86463 6.64969 1.6442 6.48436 1.58646 6.35577C1.56547 6.31116 1.57334 6.28229 1.58909 6.25342V6.2508ZM11.173 3.17777L10.7321 3.98342L6.55685 2.52957L6.99773 1.72392L11.173 3.17777ZM7.1683 8.41583C6.80878 8.33185 6.58834 8.16652 6.5306 8.03793C6.50961 7.99332 6.51748 7.96445 6.53323 7.93296C6.61721 7.78075 6.95836 7.62592 7.39137 7.62592C7.52521 7.62592 7.66692 7.64167 7.81388 7.67316C8.1734 7.75713 8.39384 7.92246 8.45158 8.05105C8.47257 8.09567 8.4647 8.12453 8.44895 8.15602C8.33873 8.35547 7.78501 8.55492 7.1683 8.41321V8.41583Z"
        fill="currentColor"
      />
      <path
        d="M13.0938 8.46027L18.1771 11.6671C18.4736 11.8535 18.8095 11.9506 19.1507 11.9506C19.2871 11.9506 19.4236 11.9348 19.5574 11.9059C20.0351 11.7983 20.4392 11.5097 20.7016 11.0977L23.9085 6.01444C24.4465 5.16155 24.1919 4.02786 23.3364 3.48988L18.2532 0.283009C17.8385 0.0232057 17.3504 -0.0633955 16.8728 0.0468243C16.3952 0.15442 15.991 0.443091 15.7286 0.855103L12.5217 5.93833C11.9838 6.79122 12.2383 7.92491 13.0938 8.46289V8.46027ZM17.046 0.813114C17.1221 0.794744 17.2008 0.786871 17.2769 0.786871C17.4711 0.786871 17.6627 0.841981 17.8307 0.946952L22.9139 4.15382C23.3994 4.46086 23.5463 5.10644 23.2393 5.59193L20.0324 10.6752C19.8828 10.9113 19.6519 11.074 19.3816 11.1344C19.1087 11.1974 18.8305 11.1475 18.5943 11.0006L13.5111 7.7937C13.0256 7.48666 12.8786 6.84108 13.1857 6.35559L16.3926 1.27236C16.5421 1.03618 16.7731 0.873472 17.0434 0.813114H17.046Z"
        fill="currentColor"
      />
      <path
        d="M16.4532 7.53394L19.353 7.78587C19.3845 7.78587 19.4133 7.78849 19.4448 7.78849C19.7991 7.78849 20.1298 7.60742 20.324 7.303C20.5313 6.97234 20.5392 6.5577 20.3397 6.2218L18.8649 3.71299C18.6785 3.39807 18.3505 3.2065 17.9857 3.20125C17.6262 3.196 17.2851 3.37708 17.0909 3.68674L15.6659 5.94625C15.4717 6.25591 15.4507 6.63643 15.6134 6.96447C15.7761 7.2925 16.091 7.50769 16.4558 7.53919L16.4532 7.53394ZM17.7548 4.104C17.8204 3.99903 17.9228 3.98591 17.9674 3.98591H17.97C18.012 3.98591 18.1196 3.99903 18.1826 4.10925L19.6574 6.61806C19.7283 6.73878 19.6784 6.84113 19.6522 6.88049C19.6285 6.91986 19.5524 7.00908 19.416 6.99596L16.5161 6.74403C16.3875 6.73353 16.3298 6.64431 16.3114 6.60494C16.2931 6.56558 16.2563 6.46586 16.3246 6.35826L17.7496 4.09876L17.7548 4.104Z"
        fill="currentColor"
      />
    </svg>
  );
}
