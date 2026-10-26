<script lang="ts">
  /**
   * The compose bar for generative AI input: prompt field, attachments, use
   * case, model and aspect-ratio menus, Enhance, and submit, all driven by
   * which props are given. Same props as React's `Composer`, with `class`
   * for React's `className` and a string `style`.
   *
   * Some controls show only with somewhere for them to go, so their
   * callbacks are checked for: `onAttachmentsChange` (add and remove media),
   * `onModelChange` / `onModelIdsChange` (the Model menu), `voiceInput` (the
   * mic), `onAspectRatioChange`, `onCharacterChange` and `onFrameRateChange`
   * (a world's fields), `onUseCasesChange` and `onClearUseCase` (chip
   * remove), `onRegionsChange`, `onEnhance` (the Enhance button), `onAbort`
   * (stop while submitting) and `onAttachMenuSelect` (the + menu's use cases).
   */
  import "@material/web/fab/fab.js";
  import { onDestroy } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import {
    composerAttachmentsFromFiles,
    composerAttachMenuItems,
    composerEvents,
    composerView,
    createVoiceInput,
    type ChaiEvent,
    type ComposerAttachment,
    type ComposerAttachMenuAction,
    type ComposerPromptField,
    type ComposerSubmitPayload,
    type ComposerUseCase,
    type ComposerView,
    type EditRegion,
    type GenerationUseCase,
    type MenuPlacement,
    type ModelOption,
    type OutputKind,
    type ParameterOption,
    type VoiceInputConfig,
  } from "@chai-ui/core";
  import AttachMenu from "./composer/AttachMenu.svelte";
  import Chip from "./composer/Chip.svelte";
  import PromptField from "./composer/PromptField.svelte";
  import VoiceButton from "./composer/VoiceButton.svelte";
  import VoiceWaveform from "./composer/VoiceWaveform.svelte";
  import Icon from "./Icon.svelte";
  import {
    ArrowForwardIcon,
    CloseSymbolIcon,
    ErrorIcon,
    ImageIcon,
    MusicNoteIcon,
    RetryIcon,
    StopIcon,
    VideocamIcon,
  } from "./icons.js";
  import SearchMenu from "./primitives/SearchMenu.svelte";

  interface ComposerProps {
    /** The prompt text. Controlled: Composer owns no text state of its own. */
    value: string;
    onChange: (value: string) => void;
    /** Defaults to "Describe media to create", or edit wording when the use case is an edit. */
    placeholder?: string;
    /** The prompt field's accessible name. Defaults to `placeholder`, which disappears once the person types. */
    promptLabel?: string;
    attachments?: ComposerAttachment[];
    onAttachmentsChange?: (next: ComposerAttachment[]) => void;
    onUnsupportedFile?: (fileName: string) => void;
    /** The use-case chip. Aspect ratio only renders for an image or video use case. */
    useCase?: ComposerUseCase | null;
    onClearUseCase?: () => void;
    /** What a submit means with no use case picked. Defaults to `TEXT_USE_CASE`. Never shown as a chip. */
    defaultUseCase?: ComposerUseCase;
    /** Image and Video from one prompt, with `useCases`, `modelsByKind` and `modelIds`: a Model menu each, and a model picked by hand in each (no auto-select). Other use cases run alone (`nextUseCases`). */
    multiSelectUseCases?: boolean;
    useCases?: ComposerUseCase[];
    onUseCasesChange?: (next: ComposerUseCase[]) => void;
    /** Models per use-case kind, for `multiSelectUseCases`. A kind left out gets Chai's suggested models. */
    modelsByKind?: Partial<Record<OutputKind, ModelOption[]>>;
    /** The end user can pick several models, each producing its own result, with `modelIds`. With `multiSelectUseCases`, several per use case. */
    multiSelectModels?: boolean;
    modelIds?: string[];
    onModelIdsChange?: (ids: string[]) => void;
    /** Models for the use case. Leave out for Chai's suggested Fal models; `[]` for no Model menu. */
    models?: ModelOption[];
    modelId?: string | null;
    onModelChange?: (id: string | null) => void;
    /** The model is chosen at submit: `useComposer` asks the reasoning model. Turning it on clears the pick. Ignored with `multiSelectUseCases`. */
    autoSelectModel?: boolean;
    /** An "Auto-select model" switch at the top of the Model menu, for the end user. */
    showAutoSelectToggle?: boolean;
    onAutoSelectModelChange?: (value: boolean) => void;
    /** Your own labels or a shorter list; ratios the models don't take are left out either way. */
    aspectRatios?: ParameterOption<string>[];
    aspectRatio?: string | null;
    onAspectRatioChange?: (value: string) => void;
    /** Shows the Enhance button; your handler runs the rewrite and updates the prompt. Gets the current text, which field, and the use case on screen (`mode`). */
    onEnhance?: (value: string, field: ComposerPromptField, mode?: GenerationUseCase) => void;
    /** True while your Enhance handler is running. */
    enhancing?: boolean;
    /** A world's character field (Create world), beside the environment (`value`). Shows with `onCharacterChange`. */
    character?: string;
    onCharacterChange?: (value: string) => void;
    /** A world's frame rate menu, from the selected models' `frameRates`. */
    frameRate?: number | null;
    onFrameRateChange?: (value: number) => void;
    /** Create speech's Voice menu, from the one picked model's `voices`. Not `voiceInput`, which is dictation. */
    speechVoice?: string | null;
    onSpeechVoiceChange?: (value: string) => void;
    /** Create music's Genre menu, several at once, from the picked models' `genres`. */
    genres?: string[];
    onGenresChange?: (values: string[]) => void;
    /**
     * Which way the bar's menus open. "above" for a bar docked to the bottom
     * of the screen, "below" for one docked to the top. "auto" (default)
     * measures when a menu opens: below if it fits, else above if that fits,
     * else toward the side with more room.
     */
    menuPlacement?: MenuPlacement;
    /** Everything Composer tracks. Also what retry sends, with the same payload, when `submitError` is set. */
    onSubmit: (payload: ComposerSubmitPayload) => void;
    /** The last submit's failure: submit becomes retry, and the message shows inline. */
    submitError?: string | null;
    /** Overrides the built-in "empty prompt and no attachments" check. Ignored while `submitError` is set. */
    submitDisabled?: boolean;
    /** True while a request is in flight: with `onAbort`, submit becomes stop; without, it's disabled. */
    submitting?: boolean;
    onAbort?: () => void;
    onAttachMenuSelect?: (action: ComposerAttachMenuAction) => void;
    /** Front-end analytics: what the person does in the bar, one `ChaiEvent` each, for any analytics tool. No prompt text or file contents, only lengths and counts. */
    onEvent?: (event: ChaiEvent) => void;
    /** Which + menu items to show. Each still shows only when it can work. */
    attachMenuActions?: ComposerAttachMenuAction[];
    /** An edit's regions (from `useComposer`'s `edit`), shown as colored chips while editing. */
    regions?: EditRegion[];
    onRegionsChange?: (next: EditRegion[]) => void;
    /**
     * The mic, left of submit: the transcript is added to the prompt, never
     * submitted. `{ model: "fal-ai/wizper" }` goes through your
     * `/api/chai/fal` route; `{ transcribe }` uses any provider. Off by
     * default, with no default model.
     */
    voiceInput?: VoiceInputConfig;
    disabled?: boolean;
    /** On the bar's root, e.g. to size it. */
    class?: ClassValue;
    style?: string;
  }

  let { class: className, style, ...props }: ComposerProps = $props();

  const view = $derived(composerView(props));
  const attachments = $derived(props.attachments ?? []);
  const regions = $derived(props.regions ?? []);
  const menuPlacement = $derived(props.menuPlacement ?? "auto");
  const menuItems = $derived(
    composerAttachMenuItems(props.attachMenuActions, {
      canAddMedia: Boolean(props.onAttachmentsChange),
      canSelect: Boolean(props.onAttachMenuSelect),
    })
  );
  const toMenuOption = (o: { value: string; label: string }) => ({ id: o.value, label: o.label });
  const voiceMenuOptions = $derived(
    view.voiceSections
      ? { sections: view.voiceSections.map((s) => ({ label: s.label, options: s.options.map(toMenuOption) })) }
      : { options: view.voiceOptions.map(toMenuOption) }
  );
  const autoSelectHeader = $derived(props.showAutoSelectToggle && view.offersAutoSelect);

  // Auto-select chooses at submit, so turning it on clears the current pick
  // and the trigger reads "Auto-select" until routing fills in the model.
  // svelte-ignore state_referenced_locally
  let wasAutoSelect = view.autoSelectModel;
  $effect.pre(() => {
    const on = view.autoSelectModel;
    const was = wasAutoSelect;
    wasAutoSelect = on;
    if (!on || was) return;
    if (view.multiModel) props.onModelIdsChange?.([]);
    else props.onModelChange?.(null);
  });

  // Auto-select belongs to the Model menu it was turned on in: picking
  // another use case turns it off, so the new one's model is picked by hand.
  // Only when the end user owns the switch; a builder's setting stays.
  // svelte-ignore state_referenced_locally
  let shownUseCaseKey = view.useCaseKey;
  $effect.pre(() => {
    const key = view.useCaseKey;
    if (key === shownUseCaseKey) return;
    shownUseCaseKey = key;
    if (props.autoSelectModel && props.showAutoSelectToggle) props.onAutoSelectModelChange?.(false);
  });

  function pickModel(menu: ComposerView["modelMenus"][number], id: string) {
    props.onEvent?.(composerEvents.modelPicked(menu.key, id));
    if (view.multiModel) props.onModelIdsChange?.(menu.next(id));
    else props.onModelChange?.(id);
  }

  // Which field's Enhance is running: `enhancing` is one flag for the bar.
  let enhancingField = $state<ComposerPromptField>("prompt");
  const enhanceField = (field: ComposerPromptField) =>
    props.onEnhance &&
    ((current: string) => {
      props.onEvent?.(composerEvents.enhanceClicked(field, current.length));
      enhancingField = field;
      props.onEnhance?.(current, field, view.enhanceMode);
    });

  // Voice input: a transcript is added to the prompt, never submitted.
  const voice = createVoiceInput(
    () => props.voiceInput ?? { transcribe: async () => "" },
    (text) => {
      const current = props.value;
      props.onChange(current.trim() ? `${current.trimEnd()} ${text}` : text);
    }
  );
  let voiceState = $state.raw(voice.getState());
  const stopVoice = voice.subscribe(() => (voiceState = voice.getState()));
  onDestroy(() => {
    stopVoice();
    voice.dispose();
  });

  async function onFiles(files: FileList | null) {
    const onAttachments = props.onAttachmentsChange;
    if (!files || files.length === 0 || !onAttachments) return;
    // Counted now: the input is cleared for the next pick, which empties its live FileList.
    const picked = files.length;
    // Edit mode works on one image: a new one replaces it, and the edit starts over.
    const { attachments: next, unsupported } = await composerAttachmentsFromFiles(files, attachments, view.editing);
    unsupported.forEach((name) => props.onUnsupportedFile?.(name));
    props.onEvent?.(composerEvents.mediaAttached(picked - unsupported.length, unsupported.length));
    if (next) onAttachments(next);
  }

  function removeUseCase(useCase: ComposerUseCase) {
    props.onEvent?.(composerEvents.useCaseRemoved(useCase));
    if (props.multiSelectUseCases) props.onUseCasesChange?.((props.useCases ?? []).filter((u) => u.kind !== useCase.kind));
    else props.onClearUseCase?.();
  }

  function onSubmitClick() {
    if (view.showStop) {
      props.onEvent?.(composerEvents.stopped());
      props.onAbort?.();
    } else if (!view.isSubmitDisabled && !props.submitting) {
      const payload = view.payload();
      props.onEvent?.(composerEvents.submitted(payload, Boolean(props.submitError)));
      props.onSubmit(payload);
    }
  }

  function onMenuSelect(action: ComposerAttachMenuAction) {
    if (action !== "add-media") props.onEvent?.(composerEvents.useCasePicked(action));
    props.onAttachMenuSelect?.(action);
  }

  function toggleAutoSelect(on: boolean) {
    props.onEvent?.(composerEvents.autoSelectToggled(on));
    props.onAutoSelectModelChange?.(on);
  }

  const revertField = (field: ComposerPromptField) => () => props.onEvent?.(composerEvents.enhanceReverted(field));

  /** An option menu's pick, reported, then passed to its handler. */
  function pickOption(option: "aspect_ratio" | "voice" | "genre" | "frame_rate", id: string, apply: () => unknown) {
    props.onEvent?.(composerEvents.optionPicked(option, id));
    apply();
  }
</script>

<div class={["chai-composer", className]} {style}>
  {#if attachments.length > 0}
    <div class="chai-composer__thumbnails">
      {#each attachments as a (a.id)}
        <div class="chai-composer__thumb">
          {#if a.kind === "image"}
            <img class="chai-composer__thumb-img" src={a.src} alt="" />
          {:else}
            <span class="chai-composer__thumb-icon"
              ><Icon icon={a.kind === "video" ? VideocamIcon : a.kind === "audio" ? MusicNoteIcon : ImageIcon} /></span
            >
          {/if}
          {#if props.onAttachmentsChange}
            <button
              type="button"
              class="chai-composer__thumb-remove"
              aria-label="Remove attachment"
              onclick={() => props.onAttachmentsChange?.(attachments.filter((x) => x.id !== a.id))}
            >
              <Icon icon={CloseSymbolIcon} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if view.editing && regions.length > 0}
    <ul class="chai-composer__regions" aria-label="Edit regions">
      {#each regions as r (r.id)}
        <li>
          <Chip
            label={`Region ${r.number}`}
            regionNumber={r.number}
            removable={Boolean(props.onRegionsChange)}
            disabled={props.disabled}
            onRemove={() => props.onRegionsChange?.(regions.filter((x) => x.id !== r.id))}
          />
        </li>
      {/each}
    </ul>
  {/if}

  {#if props.voiceInput && voiceState.status === "recording"}
    <VoiceWaveform levels={voiceState.levels} elapsedMs={voiceState.elapsedMs} />
  {:else if view.world}
    <div class="chai-composer__world-fields">
      <PromptField
        value={props.value}
        placeholder={view.placeholder}
        heading="Environment"
        note="(required)"
        hint={view.environmentHint}
        onEnhance={enhanceField("environment")}
        onRevert={revertField("environment")}
        enhancing={Boolean(props.enhancing) && enhancingField === "environment"}
        disabled={Boolean(props.disabled)}
        onChange={props.onChange}
      />
      {#if props.onCharacterChange}
        <PromptField
          value={props.character ?? ""}
          placeholder={view.characterPlaceholder}
          heading="Character"
          note="(optional)"
          onEnhance={enhanceField("character")}
          onRevert={revertField("character")}
          enhancing={Boolean(props.enhancing) && enhancingField === "character"}
          disabled={Boolean(props.disabled)}
          onChange={props.onCharacterChange}
        />
      {/if}
    </div>
  {:else}
    <PromptField
      value={props.value}
      placeholder={view.placeholder}
      label={props.promptLabel}
      onEnhance={enhanceField("prompt")}
      onRevert={revertField("prompt")}
      enhancing={Boolean(props.enhancing)}
      disabled={Boolean(props.disabled)}
      onChange={props.onChange}
    />
  {/if}

  {#if props.submitError}
    <p class="chai-composer__error" role="alert"><Icon icon={ErrorIcon} />{props.submitError}</p>
  {/if}
  {#if props.voiceInput && voiceState.status === "error"}
    <p class="chai-composer__error" role="alert"><Icon icon={ErrorIcon} />{voiceState.error}</p>
  {/if}

  <div class="chai-composer__controls">
    <div class="chai-composer__controls-start">
      {#if menuItems.length > 0}
        <AttachMenu
          items={menuItems}
          imagesOnly={view.editing}
          disabled={props.disabled}
          placement={menuPlacement}
          onSelect={onMenuSelect}
          {onFiles}
        />
      {/if}

      {#each view.pickedUseCases as u (u.kind)}
        <Chip
          label={u.label}
          removable={Boolean(props.multiSelectUseCases ? props.onUseCasesChange : props.onClearUseCase)}
          disabled={props.disabled}
          onRemove={() => removeUseCase(u)}
        />
      {/each}

      <!-- One Model menu, or one per use case with multi-use-case select. The auto-select switch lives inside each, so with it shown the trigger stays enabled: it's the only way back to the switch. -->
      {#each view.canPickModel ? view.modelMenus : [] as menu (menu.key)}
        <SearchMenu
          placement={menuPlacement}
          options={menu.options}
          value={menu.value}
          multiple={menu.multiple}
          toggleHeader={autoSelectHeader ? { label: "Auto-select model", value: view.autoSelectModel, onChange: toggleAutoSelect } : undefined}
          triggerLabel={menu.triggerLabel}
          menuLabel={menu.menuLabel}
          searchable={false}
          triggerVariant="text"
          disabled={props.disabled || (view.autoSelectModel && !autoSelectHeader)}
          panelWidth={autoSelectHeader ? 320 : undefined}
          onSelect={(o) => pickModel(menu, o.id)}
        />
      {/each}

      {#if view.showAspectRatio && view.aspectOptions.length > 0 && props.onAspectRatioChange}
        <SearchMenu
          placement={menuPlacement}
          options={view.aspectOptions.map((o) => ({ id: o.value, label: o.label }))}
          value={view.offeredAspect}
          triggerLabel={view.selectedAspect?.label ?? "Aspect ratio"}
          menuLabel="Aspect ratio"
          searchable={false}
          triggerVariant="text"
          disabled={props.disabled}
          onSelect={(o) => pickOption("aspect_ratio", o.id, () => props.onAspectRatioChange?.(o.id))}
        />
      {/if}

      {#if view.voiceOptions.length > 0 && props.onSpeechVoiceChange}
        <SearchMenu
          placement={menuPlacement}
          {...voiceMenuOptions}
          value={view.offeredVoice}
          triggerLabel={view.voiceTriggerLabel}
          menuLabel="Voice"
          searchable={view.voiceOptions.length > view.searchableAt}
          triggerVariant="text"
          disabled={props.disabled}
          onSelect={(o) => pickOption("voice", o.id, () => props.onSpeechVoiceChange?.(o.id))}
        />
      {/if}

      {#if view.genreOptions.length > 0 && props.onGenresChange}
        <SearchMenu
          placement={menuPlacement}
          options={view.genreOptions.map(toMenuOption)}
          value={view.offeredGenres}
          multiple
          triggerLabel={view.genreTriggerLabel}
          menuLabel="Genre"
          searchable={view.genreOptions.length > view.searchableAt}
          triggerVariant="text"
          disabled={props.disabled}
          onSelect={(o) => pickOption("genre", o.id, () => props.onGenresChange?.(view.toggledGenres(o.id)))}
        />
      {/if}

      {#if view.frameRateOptions.length > 0 && props.onFrameRateChange}
        <SearchMenu
          placement={menuPlacement}
          options={view.frameRateOptions.map((r) => ({ id: String(r), label: `${r}fps` }))}
          value={view.offeredFrameRate == null ? null : String(view.offeredFrameRate)}
          triggerLabel={view.offeredFrameRate == null ? "Frame rate" : `${view.offeredFrameRate}fps`}
          menuLabel="Frame rate"
          searchable={false}
          triggerVariant="text"
          disabled={props.disabled}
          onSelect={(o) => pickOption("frame_rate", o.id, () => props.onFrameRateChange?.(Number(o.id)))}
        />
      {/if}
    </div>

    <div class="chai-composer__controls-end">
      {#if props.voiceInput}
        <VoiceButton {voice} state={voiceState} disabled={props.disabled} onStart={() => props.onEvent?.(composerEvents.voiceStarted())} />
      {/if}
      <!-- MD3's md-fab has no disabled state of its own; Chai's unfilled-until-ready look comes from `data-ready` in style.css. `label=""` keeps it a plain icon FAB.
           Hidden while a recording is made or transcribed: the transcript is sent once it's in the prompt to check.
           It renders its own focusable button, so Enter and Space reach this click handler. -->
      {#if !(props.voiceInput && (voiceState.status === "recording" || voiceState.status === "transcribing"))}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <md-fab
          class="chai-composer__submit"
          size="small"
          variant="secondary"
          label=""
          data-ready={view.showStop || !view.isSubmitDisabled || undefined}
          data-error={Boolean(props.submitError) || undefined}
          data-stop={view.showStop || undefined}
          aria-label={view.showStop ? "Stop" : props.submitError ? "Retry" : "Submit"}
          aria-disabled={view.showStop ? "false" : props.submitting || view.isSubmitDisabled ? "true" : "false"}
          onclick={onSubmitClick}
        >
          <span slot="icon"><Icon icon={view.showStop ? StopIcon : props.submitError ? RetryIcon : ArrowForwardIcon} /></span>
        </md-fab>
      {/if}
    </div>
  </div>
</div>
