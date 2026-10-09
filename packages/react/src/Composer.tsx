import { StopIcon } from "./icons.js";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createComponent } from "@lit/react";
import * as React from "react";
import { MdFab } from "@material/web/fab/fab.js";
import {
  composerAttachmentsFromFiles,
  composerAttachMenuItems,
  composerView,
  enhanceRevealDurationMs,
  MAX_ANIMATE_ENHANCE_LENGTH,
  regionColor,
  TEXT_USE_CASE,
  type ComposerAttachMenuAction,
} from "@chai-ui/core";
import type { EditRegion, ModelOption, ParameterOption, MediaKind } from "@chai-ui/core";
import { SearchMenu } from "./primitives/SearchMenu.js";
import type { ComposerAttachment, ComposerSubmitPayload, ComposerUseCase } from "@chai-ui/core";

export {
  EDIT_IMAGE_USE_CASE,
  TEXT_USE_CASE,
  type ComposerAttachMenuAction,
  type ComposerAttachment,
  type ComposerSelection,
  type ComposerSubmitPayload,
  type ComposerUseCase,
} from "@chai-ui/core";

/** See primitives/Toggle.tsx for why `createComponent` is used instead of raw JSX on custom-element tags. */
const MdFabElement = createComponent({
  react: React,
  tagName: "md-fab",
  elementClass: MdFab,
  events: { onClick: "click" },
});

export interface ComposerProps {
  /** The prompt text. Controlled — Composer owns no text state of its own. */
  value: string;
  onChange: (value: string) => void;
  /** Defaults to "Describe media to create", or edit wording when the use case is an edit. */
  placeholder?: string;
  /** The prompt field's accessible name, read by screen readers. Defaults to `placeholder`, which disappears once the person types. */
  promptLabel?: string;
  attachments?: ComposerAttachment[];
  onAttachmentsChange?: (next: ComposerAttachment[]) => void;
  onUnsupportedFile?: (fileName: string) => void;
  /** The use-case chip. Aspect ratio only renders for an image or video use case. */
  useCase?: ComposerUseCase | null;
  onClearUseCase?: () => void;
  /** What a submit means with no use case picked. Defaults to `TEXT_USE_CASE`, a text request. Never shown as a chip. */
  defaultUseCase?: ComposerUseCase;
  /**
   * Builder opt-in, off by default: several use cases at once (e.g. an image
   * and a video from one prompt), at most one per kind. Uses `useCases`,
   * `onUseCasesChange` and `modelsByKind` instead of `useCase` and `models`;
   * the model menu shows one section per picked use case.
   */
  multiSelectUseCases?: boolean;
  useCases?: ComposerUseCase[];
  onUseCasesChange?: (next: ComposerUseCase[]) => void;
  /** Models per use-case kind, for `multiSelectUseCases`. A kind left out gets Chai's suggested models (see `models`). */
  modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
  /**
   * Builder opt-in, off by default: the end user can pick several models,
   * each producing its own result (ResultCard pages through them). Uses
   * `modelIds` and `onModelIdsChange` instead of `modelId` and
   * `onModelChange`. Always on with `multiSelectUseCases`.
   */
  multiSelectModels?: boolean;
  modelIds?: string[];
  onModelIdsChange?: (ids: string[]) => void;
  /**
   * Models for the current use case. Leave it out and Composer offers Chai's
   * suggested Fal models for the use case (`suggestedModels`), with the
   * first one picked until the person picks another. Pass a list to use
   * your own; pass `[]` for no Model menu.
   */
  models?: ModelOption[];
  modelId?: string | null;
  /** `null` clears the pick: Composer does this when auto-select turns on, until routing picks a model. */
  onModelChange?: (id: string | null) => void;
  /**
   * When true, the model is chosen at submit: `useComposer` asks the
   * reasoning model to pick from each use case's models. The trigger reads
   * "Auto-select" until a submit routes, then shows the pick.
   */
  autoSelectModel?: boolean;
  /**
   * Shows an "Auto-select model" switch at the top of the Model menu
   * (same `toggleHeader` pattern as MediaAnalyzer), letting the *end user*
   * flip `autoSelectModel` themselves — a builder opt-in, not the default.
   * Omit (the default) to keep `autoSelectModel` a builder-only setting:
   * when true, the Model trigger renders disabled with nothing the end
   * user can interact with to change it.
   */
  showAutoSelectToggle?: boolean;
  /** Fires when the end user toggles the switch — only reachable when `showAutoSelectToggle` is true. */
  onAutoSelectModelChange?: (value: boolean) => void;
  /**
   * Optional. The Aspect ratio menu comes from the selected models'
   * `ModelOption.aspectRatios`; pass this only for your own labels or a
   * shorter list. Ratios the models don't take are left out either way.
   */
  aspectRatios?: ParameterOption<string>[];
  aspectRatio?: string | null;
  onAspectRatioChange?: (value: string) => void;
  /**
   * The "optimize prompt" button — rewrites a
   * sparse prompt into a stronger one via an LLM call. Composer owns none
   * of that call itself: `onEnhance` fires, the builder's own code is what
   * actually runs the rewrite (through whichever `Engine`/model they've
   * configured, §5.1) and calls `onChange` with the result. Omit this prop
   * to hide the button entirely — e.g. before a builder has wired an
   * engine at all, there's nothing for it to do yet. Which model actually
   * runs the rewrite is still an open question at the design-doc level,
   * not just an implementation gap — see the design open question 5
   * ("Enhance model"). Receives the current prompt text so the handler is
   * self-contained — doesn't need its own closure over `value`.
   */
  onEnhance?: (value: string) => void;
  /** True while the builder's own `onEnhance` handler is running its LLM call — shows the button's active state. */
  enhancing?: boolean;
  /** Fires with everything Composer tracks — see `ComposerSubmitPayload`. Also what retry calls, with the same payload, when `submitError` is set. */
  onSubmit: (payload: ComposerSubmitPayload) => void;
  /**
   * A short, human-readable message for the last submit's failure —
   * Composer never sets or clears this itself, the app does (it's the one
   * that knows whether the actual generation succeeded). While set: the
   * submit FAB becomes a retry action (arrow → refresh icon, danger-
   * tinted) instead of disabling, and a compact inline message appears
   * above the controls row — no blocking dialog. Most real generation UIs
   * don't interrupt with an error dialog on a failed request; they let you
   * try again from where you were, which is what this models. Clear it
   * (pass `null`/`undefined`) once a retry succeeds or the prompt changes.
   */
  submitError?: string | null;
  /** Overrides the built-in "empty prompt and no attachments" disabled check. Ignored while `submitError` is set — retry stays available regardless. */
  submitDisabled?: boolean;
  /**
   * True while the builder's own `onSubmit` handler has a request in
   * flight — swaps the submit FAB's arrow for a stop icon. Composer owns
   * none of the actual cancellation, same rule `onEnhance` already follows:
   * this is the affordance only, `onAbort` is what the app does with the
   * click. Omit `onAbort` (even with `submitting` true) to leave the FAB
   * merely disabled instead — same "presence of the callback is the opt-in"
   * shape `onEnhance` uses.
   */
  submitting?: boolean;
  /** Fires when the stop icon is clicked while `submitting` is true. See `submitting`'s own doc comment for why this — not `submitting` alone — is what actually shows the stop icon. */
  onAbort?: () => void;
  onAttachMenuSelect?: (action: ComposerAttachMenuAction) => void;
  /**
   * Which `+` menu items to show. Defaults to all of them. Either way, an
   * item only shows when it can work: "Add media" needs
   * `onAttachmentsChange`, and the use-case items need `onAttachMenuSelect`.
   */
  attachMenuActions?: ComposerAttachMenuAction[];
  /**
   * An edit's regions (from `useComposer`'s `edit`), shown as colored chips
   * while the use case is an edit. Removing a chip removes its region.
   */
  regions?: EditRegion[];
  onRegionsChange?: (next: EditRegion[]) => void;
  disabled?: boolean;
}

/**
 * The `bar`-layout Composer —
 * reference: the "Compose Component" design, whose four states (minimal / model+aspect select / auto-select with
 * attachments / attach-menu open) are all this one controlled component,
 * driven by which props are supplied, not four separate components.
 *
 * The container chrome (flat cool gray, 22px pill radius) comes from the
 * `control-*` semantic tokens, restylable per instance through the
 * `--chai-composer-*` custom properties in style.css.
 */
export function Composer({
  value,
  onChange,
  placeholder,
  promptLabel,
  attachments = [],
  onAttachmentsChange,
  onUnsupportedFile,
  useCase = null,
  onClearUseCase,
  defaultUseCase = TEXT_USE_CASE,
  multiSelectUseCases = false,
  useCases = [],
  onUseCasesChange,
  modelsByKind,
  multiSelectModels = false,
  modelIds = [],
  onModelIdsChange,
  models,
  modelId = null,
  onModelChange,
  autoSelectModel = false,
  showAutoSelectToggle = false,
  onAutoSelectModelChange,
  aspectRatios,
  aspectRatio = null,
  onAspectRatioChange,
  onEnhance,
  enhancing = false,
  onSubmit,
  submitError = null,
  submitDisabled,
  submitting = false,
  onAbort,
  onAttachMenuSelect,
  attachMenuActions,
  regions = [],
  onRegionsChange,
  disabled = false,
}: ComposerProps) {
  const view = composerView({
    value,
    placeholder,
    attachments,
    useCase,
    defaultUseCase,
    multiSelectUseCases,
    useCases,
    modelsByKind,
    multiSelectModels,
    modelIds,
    models,
    modelId,
    onModelChange,
    onModelIdsChange,
    autoSelectModel,
    aspectRatios,
    aspectRatio,
    submitError,
    submitDisabled,
    submitting,
    onAbort,
    regions,
    disabled,
  });
  const { editing, isSubmitDisabled, showStop, multiModel, modelSections, pickedModelIds, aspectOptions, offeredAspect } = view;

  function toggleModel(id: string) {
    if (!multiModel) return onModelChange?.(id);
    onModelIdsChange?.(view.toggledModelIds(id));
  }

  // Auto-select chooses at submit, from the prompt (`useComposer` routes
  // with the reasoning model). Turning it on clears the current pick, so
  // the trigger reads "Auto-select" until routing fills in the real model.
  const wasAutoSelect = useRef(autoSelectModel);
  useEffect(() => {
    if (autoSelectModel && !wasAutoSelect.current) {
      if (multiModel) onModelIdsChange?.([]);
      else onModelChange?.(null);
    }
    wasAutoSelect.current = autoSelectModel;
  }, [autoSelectModel, multiModel, onModelChange, onModelIdsChange]);

  // Auto-grows with wrapped content instead of a fixed row count — a
  // static `rows` either hides wrapped lines behind a scrollbar (too
  // short) or wastes space while empty (too tall). Starts at one line
  // (matching the mock's compact minimal state) and grows only as typed
  // text actually wraps.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // The optimize/undo cycle (§ its own button below). `value` is already
  // the final rewritten text the instant `enhancing` drops back to false —
  // the reveal below is a purely cosmetic overlay on top of it, not a
  // delay, so nothing here ever gates what the real `<textarea>` holds.
  const [originalValue, setOriginalValue] = useState<string | null>(null);
  const [enhancedValue, setEnhancedValue] = useState<string | null>(null);
  const [prevEnhancing, setPrevEnhancing] = useState(enhancing);
  const [animatingText, setAnimatingText] = useState<string | null>(null);
  const [revealedLength, setRevealedLength] = useState(0);

  // React to `enhancing` dropping back to false while rendering, not in an
  // effect (the rules of React): that's the moment the rewrite has landed.
  if (prevEnhancing !== enhancing) {
    setPrevEnhancing(enhancing);
    if (prevEnhancing && !enhancing && originalValue != null && value !== originalValue) {
      setEnhancedValue(value);
      // Bails on length (see the constant's own comment) or on a real
      // `prefers-reduced-motion` request — the reveal is itself motion, not
      // just the shimmer the CSS `@media` query above separately turns off.
      const reducedMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (value.length <= MAX_ANIMATE_ENHANCE_LENGTH && !reducedMotion) {
        setRevealedLength(0);
        setAnimatingText(value);
      }
    }
  }

  useEffect(() => {
    if (animatingText == null) return;
    const total = animatingText.length;
    const duration = enhanceRevealDurationMs(total);
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.min(total, Math.floor((elapsed / duration) * total));
      setRevealedLength((prev) => (prev === next ? prev : next));
      if (next < total) raf = requestAnimationFrame(tick);
      else setAnimatingText(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animatingText]);

  const animating = animatingText != null;
  const isEnhanced = !animating && enhancedValue != null && value === enhancedValue;
  const enhanceBusy = enhancing || animating;

  function handleOptimizeClick() {
    if (isEnhanced) {
      const original = originalValue;
      setEnhancedValue(null);
      setOriginalValue(null);
      if (original != null) onChange(original);
      return;
    }
    setOriginalValue(value); // snapshot now — before the rewrite lands, for undo
    onEnhance?.(value);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !onAttachmentsChange) return;
    // Edit mode works on one image: a new one replaces it, and the edit starts over.
    const { attachments: next, unsupported } = await composerAttachmentsFromFiles(fileList, attachments, editing);
    unsupported.forEach((name) => onUnsupportedFile?.(name));
    if (next) onAttachmentsChange(next);
  }

  // Only items that can work: no menu item that silently does nothing.
  const menuItems = composerAttachMenuItems(attachMenuActions, {
    canAddMedia: Boolean(onAttachmentsChange),
    canSelect: Boolean(onAttachMenuSelect),
  });

  function handleRemoveAttachment(id: string) {
    onAttachmentsChange?.(attachments.filter((a) => a.id !== id));
  }

  return (
    <div className="chai-composer">
      {attachments.length > 0 && (
        <div className="chai-composer__thumbnails">
          {attachments.map((a) => (
            <ComposerThumbnail
              key={a.id}
              attachment={a}
              onRemove={onAttachmentsChange ? () => handleRemoveAttachment(a.id) : undefined}
            />
          ))}
        </div>
      )}

      {editing && regions.length > 0 && (
        <ul className="chai-composer__regions" aria-label="Edit regions">
          {regions.map((r) => (
            <li key={r.id}>
              <RegionChip
                region={r}
                onRemove={onRegionsChange ? () => onRegionsChange(regions.filter((x) => x.id !== r.id)) : undefined}
                disabled={disabled}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="chai-composer__field">
        <textarea
          ref={textareaRef}
          className={`chai-composer__input chai-composer__type${animating ? " chai-composer__input--revealing" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={view.placeholder}
          aria-label={promptLabel ?? view.placeholder}
          rows={1}
          disabled={disabled || animating}
        />
        {/* The optimize/undo reveal overlay — decorative only. The real
            textarea above already holds the final text throughout (just
            visually suppressed via `--revealing`); this div paints the
            same text back in progressively with a gradient, then unmounts.
            `aria-hidden` so a screen reader isn't told the text twice —
            the textarea's own (already-final) value is what it reads. */}
        {animating && (
          <div className="chai-composer__reveal chai-composer__type" aria-hidden="true">
            <span className="chai-composer__reveal-text">{animatingText!.slice(0, revealedLength)}</span>
          </div>
        )}
        {/* "Optimize prompt" / "Revert to original prompt" — see
            `onEnhance`'s own doc comment on `ComposerProps` for what the
            rewrite itself actually does and why Composer doesn't run it.
            Once a rewrite lands, this becomes an undo affordance instead —
            an already-optimized prompt can't be re-optimized — and reverts
            to a plain optimize button again the moment `value` no longer
            matches that rewrite exactly, i.e. the person has since edited
            it by hand. */}
        {onEnhance && (
          <button
            type="button"
            className={`chai-composer__optimize${enhanceBusy ? " chai-composer__optimize--active" : ""}`}
            onClick={handleOptimizeClick}
            disabled={disabled || (isEnhanced ? false : !value.trim() || enhanceBusy)}
            aria-label={isEnhanced ? "Revert to original prompt" : "Optimize prompt"}
            title={isEnhanced ? "Revert to original prompt" : "Optimize prompt"}
          >
            {isEnhanced ? <UndoIcon /> : <OptimizeIcon />}
          </button>
        )}
      </div>

      {submitError && (
        <p className="chai-composer__error" role="alert">
          <ErrorIcon />
          {submitError}
        </p>
      )}

      <div className="chai-composer__controls">
        <div className="chai-composer__controls-start">
          {menuItems.length > 0 && (
            <ComposerAttachMenu
              items={menuItems}
              onSelect={onAttachMenuSelect}
              onAddMediaFiles={handleFilesSelected}
              imagesOnly={editing}
              disabled={disabled}
            />
          )}

          {view.pickedUseCases.map((u) => (
            <UseCaseChip
              key={u.kind}
              useCase={u}
              onRemove={
                multiSelectUseCases
                  ? onUseCasesChange && (() => onUseCasesChange(useCases.filter((x) => x.kind !== u.kind)))
                  : onClearUseCase
              }
              disabled={disabled}
            />
          ))}

          {/* The Model menu shows whenever there are models for the current
              use case(s), picked or default. The auto-select switch lives
              inside it (builder opt-in, `showAutoSelectToggle`), so the
              trigger stays enabled whenever the switch is shown — it's the
              only way back to the switch. Rows are disabled by `SearchMenu`
              itself while auto-select is on. */}
          {modelSections.length > 0 && view.canPickModel && (
            <SearchMenu
              {...(multiSelectUseCases
                ? { sections: modelSections.map((s) => ({ label: s.label, options: s.options })) }
                : { options: modelSections[0]!.options })}
              value={multiModel ? pickedModelIds : modelId}
              multiple={multiModel}
              toggleHeader={
                showAutoSelectToggle
                  ? {
                      label: "Auto-select model",
                      value: autoSelectModel,
                      onChange: (v) => onAutoSelectModelChange?.(v),
                    }
                  : undefined
              }
              triggerLabel={view.modelTriggerLabel}
              menuLabel={multiModel ? "Select models" : "Select model"}
              onSelect={(opt) => toggleModel(opt.id)}
              searchable={false}
              triggerVariant="text"
              disabled={disabled || (autoSelectModel && !showAutoSelectToggle)}
              panelWidth={showAutoSelectToggle ? 320 : undefined}
            />
          )}

          {view.showAspectRatio && aspectOptions.length > 0 && onAspectRatioChange && (
            <SearchMenu
              options={aspectOptions.map((o) => ({ id: o.value, label: o.label }))}
              value={offeredAspect}
              triggerLabel={view.selectedAspect?.label ?? "Aspect ratio"}
              menuLabel="Aspect ratio"
              onSelect={(opt) => onAspectRatioChange?.(opt.id)}
              searchable={false}
              triggerVariant="text"
              disabled={disabled}
            />
          )}
        </div>

        {/* MD3's `<md-fab>` has no `disabled` property of its own (FABs are
            meant to always be actionable) — the disabled look/behavior here
            is CHAI's own, via the `[data-ready]` CSS override below
            (reference: the mock's icon-only, unfilled, shadowless submit
            button that only fills brand-green once there's a valid prompt).
            `label=""` rather than "Submit": any non-empty `label` switches
            `<md-fab>` into its "extended" layout with a visible text label,
            which the mock doesn't show — the accessible name comes from
            `ariaLabel` instead (see the cast below for why camelCase, not
            `aria-label`). Not `aria-disabled` for the interaction state:
            `@lit/react`'s `createComponent` only routes a prop to the
            element as a *property* when it matches a name already on the
            element's prototype, and `MdFab`'s ARIAMixin exposes that as
            camelCase `ariaDisabled` — the kebab-case `aria-disabled` prop
            doesn't match, so it falls through to a plain React attribute,
            and React's custom-element ARIA handling silently rewrites it to
            `data-aria-disabled` rather than a real `aria-disabled`
            attribute or the `ariaDisabled` property. Also tried the
            "surface" variant for the not-ready look, but a green-seeded M3
            theme's own surface containers still pick up a faint tint from
            dynamic color, so it never actually reads neutral — overriding
            the FAB's own `--md-fab-secondary-*` custom properties directly
            was the only way to get a flat, unfilled rest state. `size=
            "small"`, not "medium": at rest this button shows only its
            24px icon (transparent container), so "medium"'s real 56px
            circle read as oversized the moment hover/focus made it
            visible — "small" is a real MD3 size variant (not a custom
            override) at 40px, and MD3's own default icon size is the same
            24px at both sizes, so the arrow itself doesn't change.
            `data-error` swaps it to a danger-tinted retry action — see
            `submitError`'s own doc comment on `ComposerProps` for why
            retry replaces the button instead of a separate dialog/action.
            `showStop` swaps it to a stop action instead, still `data-ready`
            (same filled look — reads as "in progress," not "empty/error"),
            clickable regardless of `isSubmitDisabled` since a request
            already in flight isn't gated on the field having content. */}
        <MdFabElement
          className="chai-composer__submit"
          size="small"
          variant="secondary"
          label=""
          data-ready={showStop || !isSubmitDisabled || undefined}
          data-error={Boolean(submitError) || undefined}
          data-stop={showStop || undefined}
          // `createComponent`'s generated prop types come from React's own
          // `HTMLAttributes` (kebab-case `aria-*` only) and don't reflect
          // its runtime routing rule (camelCase properties already on the
          // element's prototype get set as real properties — see the
          // comment above) — cast needed to reach both this way.
          {...({
            ariaLabel: showStop ? "Stop" : submitError ? "Retry" : "Submit",
            ariaDisabled: showStop ? "false" : submitting ? "true" : isSubmitDisabled ? "true" : "false",
          } as Record<string, unknown>)}
          onClick={() => {
            if (showStop) onAbort?.();
            else if (!isSubmitDisabled && !submitting) onSubmit(view.payload());
          }}
        >
          <span slot="icon">
            {showStop ? <StopIcon /> : submitError ? <RefreshIcon /> : <ArrowForwardIcon />}
          </span>
        </MdFabElement>
      </div>
    </div>
  );
}

const ATTACH_MENU_ICONS: Record<ComposerAttachMenuAction, React.ReactNode> = {
  "add-media": <AttachFileIcon />,
  "create-image": <ImageIcon />,
  "create-video": <VideocamIcon />,
  "edit-media": <ContentCutIcon />,
};

/**
 * The "+" / "×" attach control (reference: Composer_01 "Menu open" state,
 * Figma "Menu - Icon button Example") — hand-rolled positioned
 * popover rather than `<md-menu>`, same reasoning `SearchMenu` already
 * documents for its own panel (this needs to live inline under the trigger,
 * not `<md-menu>`'s corner-anchored popover model).
 */
function ComposerAttachMenu({
  items,
  onSelect,
  onAddMediaFiles,
  imagesOnly,
  disabled,
}: {
  items: ReturnType<typeof composerAttachMenuItems>;
  onSelect?: (action: ComposerAttachMenuAction) => void;
  onAddMediaFiles: (files: FileList | null) => void;
  /** Edit mode: one image file at a time. */
  imagesOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleItemClick(action: ComposerAttachMenuAction) {
    setOpen(false);
    if (action === "add-media") inputRef.current?.click();
    onSelect?.(action);
  }

  return (
    <div className="chai-composer__attach" ref={rootRef}>
      <button
        type="button"
        className={`chai-composer__attach-toggle${open ? " chai-composer__attach-toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Close attach menu" : "Add media"}
      >
        {open ? <CloseIcon /> : <PlusIcon />}
      </button>

      {open && (
        <ul className="chai-composer__attach-menu" role="menu">
          {items.map((item, i) => (
            <li key={item.action} role="none">
              <button
                type="button"
                role="menuitem"
                className="chai-composer__attach-menu-item"
                onClick={() => handleItemClick(item.action)}
              >
                <span className="chai-composer__attach-menu-icon">{ATTACH_MENU_ICONS[item.action]}</span>
                {item.label}
              </button>
              {item.divider && i < items.length - 1 && <hr className="chai-composer__attach-menu-divider" role="separator" />}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={imagesOnly ? "image/*" : "image/*,video/*,audio/*"}
        multiple={!imagesOnly}
        hidden
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onAddMediaFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ComposerThumbnail({ attachment, onRemove }: { attachment: ComposerAttachment; onRemove?: () => void }) {
  return (
    <div className="chai-composer__thumb">
      {attachment.kind === "image" ? (
        <img className="chai-composer__thumb-img" src={attachment.src} alt="" />
      ) : (
        <span className="chai-composer__thumb-icon">{kindIcon(attachment.kind)}</span>
      )}
      {onRemove && (
        <button type="button" className="chai-composer__thumb-remove" onClick={onRemove} aria-label="Remove attachment">
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

/**
 * The use-case chip (reference: the mock's "Video"/"Image" chip) —
 * hand-rolled rather than `@material/web`'s `<md-input-chip>`: that
 * component only ever renders its remove action always-visible (no
 * exposed shadow part for the trailing button, confirmed against its
 * source), but this design wants it hidden until hover, and a rounded-
 * square shape rather than MD3 input chip's stadium default. Same
 * "hand-roll when the primitive doesn't give the needed control" call
 * `SearchMenu`'s own panel already documents. No leading icon — that's the
 * attach menu's own affordance (each of its four items has one); the chip
 * itself is label + hover-revealed remove only.
 */
function UseCaseChip({
  useCase,
  onRemove,
  disabled,
}: {
  useCase: ComposerUseCase;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="chai-composer__chip">
      {useCase.label}
      {onRemove && (
        <button
          type="button"
          className="chai-composer__chip-remove"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${useCase.label}`}
        >
          <CloseIcon />
        </button>
      )}
    </span>
  );
}

/**
 * One edit region, in its region color: a numbered badge matching the box on
 * the image, its name, and the same hover-revealed remove as the use-case
 * chip. The instruction itself lives on the image, not here.
 */
function RegionChip({
  region,
  onRemove,
  disabled,
}: {
  region: EditRegion;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const name = `Region ${region.number}`;
  return (
    <span
      className="chai-composer__chip chai-composer__chip--region"
      style={{ "--chai-region-color": regionColor(region.number) } as React.CSSProperties}
    >
      <span className="chai-composer__region-badge" aria-hidden="true">
        {region.number}
      </span>
      {name}
      {onRemove && (
        <button
          type="button"
          className="chai-composer__chip-remove"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
        >
          <CloseIcon />
        </button>
      )}
    </span>
  );
}

function kindIcon(kind: MediaKind) {
  switch (kind) {
    case "video":
      return <VideocamIcon />;
    case "audio":
      return <AudioIcon />;
    default:
      return <ImageIcon />;
  }
}

// --- Icons -------------------------------------------------------------
//
// Every icon below except `OptimizeIcon` is a real Material Symbols path
// (viewBox `0 -960 960 960`, the current Material Symbols coordinate
// system), copied exactly from the `@material-symbols/svg-400` package
// (Apache-2.0, installed as a devDependency purely as a source of ground-
// truth vector data — nothing here imports it at runtime, matching this
// codebase's existing "trace and inline as a currentColor component"
// convention). Fixes an earlier pass
// that hand-approximated several of these (Add media/Create image/Create
// video/Edit media's icons, plus/close/arrow) because `get_design_context`
// couldn't resolve their specific instance-swap nodes — those
// approximations read as visibly off-brand, not real MD3, correctly
// flagged and replaced with the genuine glyphs (add, close, arrow_forward,
// attach_file, image, videocam, content_cut, music_note).
//
// `OptimizeIcon` is the one exception, still traced exactly from the real
// exported design asset ("Optimize_icon") — not a Material Symbol at all, this is CHAI's own "prompt
// optimize" glyph (a pencil plus two sparkles). Same shape in both source
// assets, differing only by fill color (brand green active, gray
// inactive) — collapsed here to one currentColor path set,
// themed via the active/inactive CSS class instead of two hardcoded-color
// SVGs. See its button's own doc comment above for what it actually does.

function PlusIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z" fill="currentColor" />
    </svg>
  );
}

// Material Symbols "close" — reproduced here since icons aren't shared
// across files yet in this codebase.
function CloseIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" fill="currentColor" />
    </svg>
  );
}

function ArrowForwardIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M686-450H160v-60h526L438-758l42-42 320 320-320 320-42-42 248-248Z" fill="currentColor" />
    </svg>
  );
}

// Material Symbols "refresh" — the submit FAB's retry state.
function RefreshIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M480-160q-133 0-226.5-93.5T160-480q0-133 93.5-226.5T480-800q85 0 149 34.5T740-671v-129h60v254H546v-60h168q-38-60-97-97t-137-37q-109 0-184.5 75.5T220-480q0 109 75.5 184.5T480-220q83 0 152-47.5T728-393h62q-29 105-115 169t-195 64Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Material Symbols "error" — the inline retry message's leading icon.
function ErrorIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M503.5-289.48q9.5-9.48 9.5-23.5t-9.48-23.52q-9.48-9.5-23.5-9.5t-23.52 9.48q-9.5 9.48-9.5 23.5t9.48 23.52q9.48 9.5 23.5 9.5t23.52-9.48ZM453-433h60v-253h-60v253Zm27.27 353q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z"
        fill="currentColor"
      />
    </svg>
  );
}

function OptimizeIcon() {
  return (
    <svg viewBox="0 0 25 24" fill="none" aria-hidden="true">
      <path
        d="M5 19H6.425L16.2 9.225L14.775 7.8L5 17.575V19ZM3 21V16.75L16.2 3.575C16.4 3.39167 16.6208 3.25 16.8625 3.15C17.1042 3.05 17.3583 3 17.625 3C17.8917 3 18.15 3.05 18.4 3.15C18.65 3.25 18.8667 3.4 19.05 3.6L20.425 5C20.625 5.18333 20.7708 5.4 20.8625 5.65C20.9542 5.9 21 6.15 21 6.4C21 6.66667 20.9542 6.92083 20.8625 7.1625C20.7708 7.40417 20.625 7.625 20.425 7.825L7.25 21H3ZM15.475 8.525L14.775 7.8L16.2 9.225L15.475 8.525Z"
        fill="currentColor"
      />
      <path d="M20 12L21.5918 15.4082L25 17L21.5918 18.5918L20 22L18.4082 18.5918L15 17L18.4082 15.4082L20 12Z" fill="currentColor" />
      <path d="M6 3L7.27345 5.72655L10 7L7.27345 8.27345L6 11L4.72655 8.27345L2 7L4.72655 5.72655L6 3Z" fill="currentColor" />
    </svg>
  );
}

// Real Material Symbols "undo" glyph (viewBox `0 -960 960 960`), same
// source/convention as every icon above except `OptimizeIcon` itself (see
// that block's own comment) — the optimize button becomes this once a
// rewrite has landed (its own doc comment, where it's rendered).
function UndoIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M259-200v-60h310q70 0 120.5-46.5T740-422q0-69-50.5-115.5T569-584H274l114 114-42 42-186-186 186-186 42 42-114 114h294q95 0 163.5 64T800-422q0 94-68.5 158T568-200H259Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AttachFileIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M728-326q0 103-72.18 174.5-72.17 71.5-175 71.5Q378-80 305.5-151.5T233-326v-380q0-72.5 51.5-123.25T408-880q72 0 123.5 50.75T583-706v360q0 42-30 72t-72.5 30q-42.5 0-72.5-29.67-30-29.68-30-72.33v-370h60v370q0 17 12.5 29.5t30.64 12.5q18.14 0 30-12.5T523-346v-360q0-48-33.5-81t-81.71-33q-48.21 0-81.5 33.06T293-706v380q0 78 54.97 132T481-140q77.92 0 132.46-54Q668-248 668-326v-390h60v390Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm56-97h489L578-473 446-302l-93-127-117 152Zm-56 97v-600 600Z"
        fill="currentColor"
      />
    </svg>
  );
}

function VideocamIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M140-160q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h520q24 0 42 18t18 42v215l160-160v410L720-435v215q0 24-18 42t-42 18H140Zm0-60h520v-520H140v520Zm0 0v-520 520Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ContentCutIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M782-114 481-415 364-298q11 17 13.5 33t2.5 35q0 64-43 107T230-80q-64 0-107-43T80-230q0-64 43-107t107-43q18 0 35.5 5t36.5 15l116-116-118-118q-17 8-34.5 11t-35.5 3q-64 0-107-43T80-730q0-64 43-107t107-43q64 0 107 43t43 107q0 19-2.5 36T367-662l514 514v34h-99ZM599-527l-66-66 249-249h99v33L599-527ZM294-666q26-26 26-64t-26-64q-26-26-64-26t-64 26q-26 26-26 64t26 64q26 26 64 26t64-26Zm202.5 203.5Q502-468 502-476t-5.5-13.5Q491-495 483-495t-13.5 5.5Q464-484 464-476t5.5 13.5Q475-457 483-457t13.5-5.5ZM294-166q26-26 26-64t-26-64q-26-26-64-26t-64 26q-26 26-26 64t26 64q26 26 64 26t64-26Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path
        d="M286.5-163.5Q243-207 243-270t43.5-106.5Q330-420 393-420q28 0 50.5 8t39.5 22v-450h234v135H543v435q0 63-43.5 106.5T393-120q-63 0-106.5-43.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
