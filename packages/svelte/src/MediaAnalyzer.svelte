<script lang="ts">
  /**
   * Turns attached media into a prompt: a drop zone for images, a video or
   * audio, a model menu with auto-select, a prompt-length menu, and submit.
   * Pair with `useMediaAnalyzer`. Same props as React's `MediaAnalyzer`.
   */
  import "@material/web/fab/fab.js";
  import {
    DEFAULT_MAX_ATTACHMENTS_BY_KIND,
    isMediaAnalyzerAtCap,
    mediaAnalyzerModelSections,
    nextMediaAnalyzerAttachments,
    PROMPT_LENGTH_HINT,
    readMediaFiles,
    replacedNote,
    SUGGESTED_ANALYSIS_MODELS,
    type MediaAnalysisPromptLength,
    type MediaAnalyzerAttachment,
    type MediaAnalyzerSubmitPayload,
    type MediaKind,
    type ModelOption,
  } from "@chai-ui/core";
  import Icon from "./Icon.svelte";
  import { ArrowForwardIcon, AudioIcon, MixedMediaIcon, RemoveIcon, StopIcon, VideoIcon } from "./icons.js";
  import SearchMenu from "./primitives/SearchMenu.svelte";

  let {
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
    disabled = false,
    submitting = false,
    submitError,
    onSubmit,
    onAbort,
  }: {
    attachments: MediaAnalyzerAttachment[];
    onAttachmentsChange: (next: MediaAnalyzerAttachment[]) => void;
    onUnsupportedFile?: (fileName: string) => void;
    maxAttachmentsByKind?: Record<MediaKind, number>;
    /** Fallback roster for a kind `modelsByKind` doesn't list. */
    models?: ModelOption[];
    /** Per-kind rosters; once a kind is attached, only its models show. Defaults to Chai's suggested OpenRouter models. */
    modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
    /** The picked model. While `autoSelectModel` is on it's `null` until a submit routes, then the routed model. */
    modelId: string | null;
    onModelChange: (id: string | null) => void;
    /** The "Auto-select model" switch inside the model menu. Turning it on clears the pick. */
    autoSelectModel: boolean;
    onAutoSelectModelChange: (next: boolean) => void;
    /** `null` until a person picks one: the trigger says "Prompt length" rather than pre-filling a choice. */
    promptLength: MediaAnalysisPromptLength | null;
    onPromptLengthChange: (value: MediaAnalysisPromptLength) => void;
    promptLengthOptions: { value: MediaAnalysisPromptLength; label: string }[];
    disabled?: boolean;
    submitting?: boolean;
    submitError?: string | null;
    onSubmit: (payload: MediaAnalyzerSubmitPayload) => void;
    /** With it, submit turns into stop while `submitting` (wire it to `useMediaAnalyzer`'s `cancel`); without it, submit is just disabled. */
    onAbort?: () => void;
  } = $props();

  let input = $state<HTMLInputElement>();
  // A count, not a boolean: dragenter/dragleave fire for every child the
  // pointer crosses too, so a boolean would flicker off over the icon or text.
  let dragDepth = $state(0);
  // What the last attach replaced (one kind per analysis), shown until the
  // attachments change some other way. Matched by ids, so a parent that
  // hands the list back as a copy still shows it.
  let replaced = $state<{ note: string; ids: string } | null>(null);
  const idsOf = (list: MediaAnalyzerAttachment[]) => list.map((a) => a.id).join();

  const kind = $derived(attachments[0]?.kind);
  const atCap = $derived(isMediaAnalyzerAtCap(attachments, maxAttachmentsByKind));
  const sections = $derived(mediaAnalyzerModelSections(kind, modelsByKind, models));
  // Looked up across every section, so a pick made before any media is attached still names itself on the trigger.
  const selectedModel = $derived(sections.flatMap((s) => s.options).find((m) => m.id === modelId));
  const modelTriggerLabel = $derived(selectedModel?.label ?? (autoSelectModel ? "Auto-select model" : "Select model"));
  // The clarifying suffix shows only in the list, never on the trigger.
  const lengthOptions = $derived(
    promptLengthOptions.map((o) => ({ id: o.value, label: o.label, rowLabel: `${o.label} (${PROMPT_LENGTH_HINT[o.value]})` }))
  );
  const lengthLabel = $derived(promptLengthOptions.find((o) => o.value === promptLength)?.label ?? "Prompt length");
  const isSubmitDisabled = $derived(disabled || attachments.length === 0);
  const showStop = $derived(Boolean(submitting && onAbort));

  // Auto-select chooses at submit, so turning it on clears the current pick
  // and the trigger says what will happen until it does.
  // svelte-ignore state_referenced_locally
  let wasAutoSelect = autoSelectModel;
  $effect.pre(() => {
    if (autoSelectModel && !wasAutoSelect) onModelChange(null);
    wasAutoSelect = autoSelectModel;
  });

  /** Reads every file first, then applies them in drop order and commits once. */
  async function handleFiles(files: FileList | null | undefined) {
    if (!files || files.length === 0) return;
    const { media, unsupported } = await readMediaFiles(files);
    unsupported.forEach((name) => onUnsupportedFile?.(name));
    if (media.length === 0) return;
    const next = media.reduce((acc, m) => nextMediaAnalyzerAttachments(acc, m, maxAttachmentsByKind), attachments);
    const note = replacedNote(attachments, next);
    replaced = note ? { note, ids: idsOf(next) } : null;
    onAttachmentsChange(next);
  }

  function ondrop(e: DragEvent) {
    e.preventDefault();
    dragDepth = 0;
    if (!disabled) void handleFiles(e.dataTransfer?.files);
  }

  function onchange(e: Event) {
    const el = e.target as HTMLInputElement;
    void handleFiles(el.files);
    el.value = "";
  }

  function onSubmitClick() {
    if (showStop) onAbort?.();
    else if (!isSubmitDisabled && !submitting) {
      onSubmit({
        attachments,
        modelId,
        autoSelectModel,
        models: kind ? (modelsByKind[kind] ?? models) : [],
        promptLength,
      });
    }
  }
</script>

<div class="chai-media-analyzer">
  <!-- Dropping is a shortcut: Select files is the way in for keyboards and screen readers. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={[
      "chai-media-analyzer__dropzone",
      { "chai-media-analyzer__dropzone--disabled": atCap, "chai-media-analyzer__dropzone--drag-active": dragDepth > 0 },
    ]}
    ondragenter={(e) => {
      e.preventDefault();
      dragDepth++;
    }}
    ondragleave={(e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
    }}
    ondragover={(e) => e.preventDefault()}
    {ondrop}
  >
    <span class="chai-media-analyzer__dropzone-icon" aria-hidden="true"><Icon icon={MixedMediaIcon} /></span>
    <!-- `atCap` is only ever true for image. -->
    <p class="chai-media-analyzer__dropzone-hint">{atCap ? "Maximum images added" : "Add media to convert to prompt"}</p>
    <button type="button" class="chai-chip-button" {disabled} onclick={() => input?.click()}>Select files</button>
    <input bind:this={input} type="file" accept="image/*,video/*,audio/*" multiple hidden {disabled} {onchange} />
  </div>

  {#if attachments.length > 0}
    <div class="chai-media-analyzer__thumbnails">
      {#each attachments as a (a.id)}
        <div class="chai-media-analyzer__thumb">
          {#if a.kind === "image"}
            <img class="chai-media-analyzer__thumb-img" src={a.src} alt="" />
          {:else}
            <span class="chai-media-analyzer__thumb-icon"><Icon icon={a.kind === "video" ? VideoIcon : AudioIcon} /></span>
          {/if}
          <button
            type="button"
            class="chai-media-analyzer__thumb-remove"
            aria-label={`Remove ${a.name ?? a.kind}`}
            onclick={() => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))}
          >
            <Icon icon={RemoveIcon} />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if replaced && replaced.ids === idsOf(attachments)}
    <p class="chai-media-analyzer__note" role="status">{replaced.note}</p>
  {/if}
  {#if submitError}<p class="chai-media-analyzer__error" role="alert">{submitError}</p>{/if}

  <div class="chai-media-analyzer__controls">
    <div class="chai-media-analyzer__controls-start">
      <SearchMenu
        options={sections.length === 1 ? sections[0]!.options : undefined}
        sections={sections.length > 1 ? sections : undefined}
        toggleHeader={{ label: "Auto-select model", value: autoSelectModel, onChange: onAutoSelectModelChange }}
        value={modelId}
        triggerLabel={modelTriggerLabel}
        menuLabel="Select model"
        searchable={false}
        triggerVariant="text"
        {disabled}
        panelWidth={320}
        onSelect={(m) => onModelChange(m.id)}
      />
      <SearchMenu
        options={lengthOptions}
        value={promptLength}
        triggerLabel={lengthLabel}
        menuLabel="Prompt length"
        searchable={false}
        triggerVariant="text"
        {disabled}
        onSelect={(o) => onPromptLengthChange(o.id)}
      />
    </div>

    <!-- The same unfilled-until-ready submit as Composer's FAB. It renders its own
         focusable button, so Enter and Space reach this click handler. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <md-fab
      class="chai-media-analyzer__submit"
      size="small"
      variant="secondary"
      label=""
      data-ready={showStop || !isSubmitDisabled || undefined}
      data-error={Boolean(submitError) || undefined}
      data-stop={showStop || undefined}
      aria-label={showStop ? "Stop" : submitError ? "Retry" : "Analyze media"}
      aria-disabled={showStop ? "false" : submitting || isSubmitDisabled ? "true" : "false"}
      onclick={onSubmitClick}
    >
      <span slot="icon"><Icon icon={showStop ? StopIcon : ArrowForwardIcon} /></span>
    </md-fab>
  </div>
</div>
