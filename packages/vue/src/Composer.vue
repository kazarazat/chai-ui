<script setup lang="ts">
/**
 * The compose bar for generative AI input: prompt field, attachments, use
 * case, model and aspect-ratio menus, Enhance, and submit, all driven by
 * which props are given. Same props as React's `Composer`, with `v-model`
 * for the prompt and `v-model:…` for attachments, use cases, models, aspect
 * ratio, auto-select and regions.
 *
 * Some controls show only with somewhere for them to go, so these listeners
 * are props, checked for: `@update:attachments` (add and remove media),
 * `@update:model-id` / `@update:model-ids` (the Model menu),
 * `voiceInput` (the mic), `@update:aspect-ratio`, `@update:character` and `@update:frame-rate` (a
 * world's fields), `@update:use-cases` and `@clear-use-case` (chip
 * remove), `@update:regions`, `@enhance` (the Enhance button), `@abort` (stop
 * while submitting) and `@attach-menu-select` (the + menu's use cases).
 */
import "@material/web/fab/fab.js";
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import {
  composerAttachmentsFromFiles,
  composerEvents,
  composerAttachMenuItems,
  composerView,
  createVoiceInput,
  type ComposerAttachment,
  type ComposerAttachMenuAction,
  type ComposerPromptField,
  type GenerationUseCase,
  type ComposerSubmitPayload,
  type ComposerUseCase,
  type ComposerView,
  type ChaiEvent,
  type EditRegion,
  type MediaKind,
  type MenuPlacement,
  type ModelOption,
  type OutputKind,
  type ParameterOption,
  type VoiceInputConfig,
} from "@chai-ui/core";
import AttachMenu from "./composer/AttachMenu.vue";
import Chip from "./composer/Chip.vue";
import PromptField from "./composer/PromptField.vue";
import VoiceButton from "./composer/VoiceButton.vue";
import VoiceWaveform from "./composer/VoiceWaveform.vue";
import type { ComposerContextChip, ComposerMenuItem } from "./composer/types.js";
import { ArrowForwardIcon, CloseSymbolIcon, ErrorIcon, ImageIcon, MusicNoteIcon, RetryIcon, StopIcon, VideocamIcon } from "./icons.js";
import SearchMenu from "./primitives/SearchMenu.vue";

const props = withDefaults(
  defineProps<{
    /** The prompt text. Controlled: use `v-model`. */
    modelValue: string;
    /** Defaults to "Describe media to create", or edit wording when the use case is an edit. */
    placeholder?: string;
    /** The prompt field's accessible name. Defaults to `placeholder`, which disappears once the person types. */
    promptLabel?: string;
    attachments?: ComposerAttachment[];
    "onUpdate:attachments"?: (next: ComposerAttachment[]) => void;
    /** The use-case chip. Aspect ratio only renders for an image or video use case. */
    useCase?: ComposerUseCase | null;
    onClearUseCase?: () => void;
    /** What a submit means with no use case picked. Defaults to `TEXT_USE_CASE`. Never shown as a chip. */
    defaultUseCase?: ComposerUseCase;
    /** Image and Video from one prompt, with `useCases`, `modelsByKind` and `modelIds`: a Model menu each, and a model picked by hand in each (no auto-select). Other use cases run alone (`nextUseCases`). */
    multiSelectUseCases?: boolean;
    useCases?: ComposerUseCase[];
    "onUpdate:useCases"?: (next: ComposerUseCase[]) => void;
    /** Models per use-case kind, for `multiSelectUseCases`. A kind left out gets Chai's suggested models. */
    modelsByKind?: Partial<Record<OutputKind, ModelOption[]>>;
    /** The end user can pick several models, each producing its own result, with `modelIds`. With `multiSelectUseCases`, several per use case. */
    multiSelectModels?: boolean;
    modelIds?: string[];
    "onUpdate:modelIds"?: (ids: string[]) => void;
    /** Models for the use case. Leave out for Chai's suggested Fal models; `[]` for no Model menu. */
    models?: ModelOption[];
    modelId?: string | null;
    "onUpdate:modelId"?: (id: string | null) => void;
    /** The model is chosen at submit: `useComposer` asks the reasoning model. Turning it on clears the pick. Ignored with `multiSelectUseCases`. */
    autoSelectModel?: boolean;
    /** An "Auto-select model" switch at the top of the Model menu, for the end user. */
    showAutoSelectToggle?: boolean;
    "onUpdate:autoSelectModel"?: (value: boolean) => void;
    /** Your own labels or a shorter list; ratios the models don't take are left out either way. */
    aspectRatios?: ParameterOption<string>[];
    aspectRatio?: string | null;
    "onUpdate:aspectRatio"?: (value: string) => void;
    /** Shows the Enhance button; your handler runs the rewrite and updates the prompt. Gets the current text, which field, and the use case on screen (`mode`). */
    onEnhance?: (value: string, field: ComposerPromptField, mode?: GenerationUseCase) => void;
    /** True while your Enhance handler is running. */
    enhancing?: boolean;
    /** A world's character field (Create world), beside the environment (`v-model`). Shows with `v-model:character`. */
    character?: string;
    "onUpdate:character"?: (value: string) => void;
    /** A world's frame rate menu, from the selected models' `frameRates`. */
    frameRate?: number | null;
    "onUpdate:frameRate"?: (value: number) => void;
    /** Create speech's Voice menu, from the one picked model's `voices` (`v-model:speech-voice`). Not `voiceInput`, which is dictation. */
    speechVoice?: string | null;
    "onUpdate:speechVoice"?: (value: string) => void;
    /** Create music's Genre menu, several at once, from the picked models' `genres` (`v-model:genres`). */
    genres?: string[];
    "onUpdate:genres"?: (values: string[]) => void;
    /**
     * Which way the bar's menus open. "above" for a bar docked to the bottom
     * of the screen, "below" for one docked to the top. "auto" (default)
     * measures when a menu opens: below if it fits, else above if that fits,
     * else toward the side with more room.
     */
    menuPlacement?: MenuPlacement;
    /** The last submit's failure: submit becomes retry, and the message shows inline. */
    submitError?: string | null;
    /** Overrides the built-in "empty prompt and no attachments" check. Ignored while `submitError` is set. */
    submitDisabled?: boolean;
    /** True while a request is in flight: with `@abort`, submit becomes stop; without, it's disabled. */
    submitting?: boolean;
    onAbort?: () => void;
    onAttachMenuSelect?: (action: ComposerAttachMenuAction) => void;
    /** Front-end analytics (`@event`): what the person does in the bar, one `ChaiEvent` each, for any analytics tool. No prompt text or file contents, only lengths and counts. */
    onEvent?: (event: ChaiEvent) => void;
    /** Which + menu items to show. Each still shows only when it can work. */
    attachMenuActions?: ComposerAttachMenuAction[];
    /** An edit's regions (from `useComposer`'s `edit`), shown as colored chips while editing. */
    regions?: EditRegion[];
    "onUpdate:regions"?: (next: EditRegion[]) => void;
    /**
     * The mic, left of submit: the transcript is added to the prompt, never
     * submitted. `{ model: "fal-ai/wizper" }` goes through your
     * `/api/chai/fal` route; `{ transcribe }` uses any provider. Off by
     * default, with no default model.
     */
    voiceInput?: VoiceInputConfig;
    disabled?: boolean;
    /** Your own items at the top of the `+` menu, above the built-in ones, e.g. "Use this page" in a side panel. */
    extraMenuItems?: ComposerMenuItem[];
    /** Chips after the use-case chip for context sent with the prompt, e.g. "This page". With `onRemove`, a chip can be removed. */
    contextChips?: ComposerContextChip[];
  }>(),
  {
    attachments: () => [],
    useCase: null,
    useCases: () => [],
    modelIds: () => [],
    modelId: null,
    aspectRatio: null,
    character: "",
    frameRate: null,
    speechVoice: null,
    genres: () => [],
    menuPlacement: "auto",
    submitError: null,
    // Left undefined unless set: Vue would make an absent boolean `false`,
    // which reads as "never disable".
    submitDisabled: undefined,
    regions: () => [],
    extraMenuItems: () => [],
    contextChips: () => [],
  }
);
const emit = defineEmits<{
  "update:modelValue": [value: string];
  /** Everything Composer tracks. Also what retry sends, with the same payload, when `submitError` is set. */
  submit: [payload: ComposerSubmitPayload];
  unsupportedFile: [fileName: string];
}>();

const view = computed(() =>
  composerView({
    ...props,
    value: props.modelValue,
    onModelChange: props["onUpdate:modelId"],
    onModelIdsChange: props["onUpdate:modelIds"],
  })
);
const menuItems = computed(() =>
  composerAttachMenuItems(props.attachMenuActions, {
    canAddMedia: Boolean(props["onUpdate:attachments"]),
    canSelect: Boolean(props.onAttachMenuSelect),
  })
);
const toMenuOption = (o: { value: string; label: string }) => ({ id: o.value, label: o.label });
const voiceMenuOptions = computed(() =>
  view.value.voiceSections
    ? { sections: view.value.voiceSections.map((s) => ({ label: s.label, options: s.options.map(toMenuOption) })) }
    : { options: view.value.voiceOptions.map(toMenuOption) }
);

// Auto-select chooses at submit, so turning it on clears the current pick
// and the trigger reads "Auto-select" until routing fills in the model.
watch(
  () => view.value.autoSelectModel,
  (on, was) => {
    if (!on || was) return;
    if (view.value.multiModel) props["onUpdate:modelIds"]?.([]);
    else props["onUpdate:modelId"]?.(null);
  }
);

// Auto-select belongs to the Model menu it was turned on in: picking
// another use case turns it off, so the new one's model is picked by hand.
// Only when the end user owns the switch; a builder's setting stays.
watch(
  () => view.value.useCaseKey,
  () => {
    if (props.autoSelectModel && props.showAutoSelectToggle) props["onUpdate:autoSelectModel"]?.(false);
  }
);

function pickModel(menu: ComposerView["modelMenus"][number], id: string) {
  props.onEvent?.(composerEvents.modelPicked(menu.key, id));
  if (view.value.multiModel) props["onUpdate:modelIds"]?.(menu.next(id));
  else props["onUpdate:modelId"]?.(id);
}

// Which field's Enhance is running: `enhancing` is one flag for the bar.
const enhancingField = ref<ComposerPromptField>("prompt");
const enhanceField = (field: ComposerPromptField) =>
  props.onEnhance &&
  ((current: string) => {
    props.onEvent?.(composerEvents.enhanceClicked(field, current.length));
    enhancingField.value = field;
    props.onEnhance?.(current, field, view.value.enhanceMode);
  });

// Voice input: a transcript is added to a prompt, never submitted. In a
// world, it goes to the field the person was last in.
const voiceField = ref<ComposerPromptField>("environment");
const voice = createVoiceInput(
  () => props.voiceInput ?? { transcribe: async () => "" },
  (text) => {
    const onCharacter = view.value.world && voiceField.value === "character" ? props["onUpdate:character"] : undefined;
    const current = onCharacter ? props.character : props.modelValue;
    const next = current.trim() ? `${current.trimEnd()} ${text}` : text;
    if (onCharacter) onCharacter(next);
    else emit("update:modelValue", next);
  }
);
const voiceState = shallowRef(voice.getState());
const stopVoice = voice.subscribe(() => (voiceState.value = voice.getState()));
onScopeDispose(() => {
  stopVoice();
  voice.dispose();
});

async function onFiles(files: FileList | null) {
  const onAttachments = props["onUpdate:attachments"];
  if (!files || files.length === 0 || !onAttachments) return;
  // Counted now: the input is cleared for the next pick, which empties its live FileList.
  const picked = files.length;
  // Edit mode works on one image: a new one replaces it, and the edit starts over.
  const { attachments, unsupported } = await composerAttachmentsFromFiles(files, props.attachments, view.value.editing);
  unsupported.forEach((name) => emit("unsupportedFile", name));
  props.onEvent?.(composerEvents.mediaAttached(picked - unsupported.length, unsupported.length));
  if (attachments) onAttachments(attachments);
}

function removeUseCase(useCase: ComposerUseCase) {
  props.onEvent?.(composerEvents.useCaseRemoved(useCase));
  if (props.multiSelectUseCases) props["onUpdate:useCases"]?.(props.useCases.filter((u) => u.kind !== useCase.kind));
  else props.onClearUseCase?.();
}

function onSubmitClick() {
  if (view.value.showStop) {
    props.onEvent?.(composerEvents.stopped());
    props.onAbort?.();
  } else if (!view.value.isSubmitDisabled && !props.submitting) {
    const payload = view.value.payload();
    props.onEvent?.(composerEvents.submitted(payload, Boolean(props.submitError)));
    emit("submit", payload);
  }
}

function onMenuSelect(action: ComposerAttachMenuAction) {
  if (action !== "add-media") props.onEvent?.(composerEvents.useCasePicked(action));
  props.onAttachMenuSelect?.(action);
}

function toggleAutoSelect(on: boolean) {
  props.onEvent?.(composerEvents.autoSelectToggled(on));
  props["onUpdate:autoSelectModel"]?.(on);
}

function revertField(field: ComposerPromptField) {
  props.onEvent?.(composerEvents.enhanceReverted(field));
}

function onVoiceStart() {
  props.onEvent?.(composerEvents.voiceStarted());
}

/** An option menu's pick, reported, then passed to its handler. */
function pickOption(option: "aspect_ratio" | "voice" | "genre" | "frame_rate", id: string, apply: () => unknown) {
  props.onEvent?.(composerEvents.optionPicked(option, id));
  apply();
}
</script>

<template>
  <div class="chai-composer">
    <div v-if="attachments.length > 0" class="chai-composer__thumbnails">
      <div v-for="a in attachments" :key="a.id" class="chai-composer__thumb">
        <img v-if="a.kind === 'image'" class="chai-composer__thumb-img" :src="a.src" alt="" />
        <span v-else class="chai-composer__thumb-icon"><VideocamIcon v-if="a.kind === 'video'" /><MusicNoteIcon v-else-if="a.kind === 'audio'" /><ImageIcon v-else /></span>
        <button
          v-if="props['onUpdate:attachments']"
          type="button"
          class="chai-composer__thumb-remove"
          aria-label="Remove attachment"
          @click="props['onUpdate:attachments']?.(attachments.filter((x) => x.id !== a.id))"
        >
          <CloseSymbolIcon />
        </button>
      </div>
    </div>

    <ul v-if="view.editing && regions.length > 0" class="chai-composer__regions" aria-label="Edit regions">
      <li v-for="r in regions" :key="r.id">
        <Chip
          :label="`Region ${r.number}`"
          :region-number="r.number"
          :removable="Boolean(props['onUpdate:regions'])"
          :disabled="disabled"
          @remove="props['onUpdate:regions']?.(regions.filter((x) => x.id !== r.id))"
        />
      </li>
    </ul>

    <VoiceWaveform v-if="voiceInput && voiceState.status === 'recording'" :levels="voiceState.levels" :elapsed-ms="voiceState.elapsedMs" />
    <div v-else-if="view.world" class="chai-composer__world-fields">
      <PromptField
        :value="modelValue"
        :placeholder="view.placeholder"
        heading="Environment"
        note="(required)"
        :on-focus="() => (voiceField = 'environment')"
        :hint="view.environmentHint"
        :on-enhance="enhanceField('environment')"
        :on-revert="() => revertField('environment')"
        :enhancing="Boolean(enhancing) && enhancingField === 'environment'"
        :disabled="disabled"
        @change="emit('update:modelValue', $event)"
      />
      <PromptField
        v-if="props['onUpdate:character']"
        :value="character"
        :placeholder="view.characterPlaceholder"
        heading="Character"
        note="(optional)"
        :on-focus="() => (voiceField = 'character')"
        :on-enhance="enhanceField('character')"
        :on-revert="() => revertField('character')"
        :enhancing="Boolean(enhancing) && enhancingField === 'character'"
        :disabled="disabled"
        @change="props['onUpdate:character']?.($event)"
      />
    </div>
    <PromptField
      v-else
      :value="modelValue"
      :placeholder="view.placeholder"
      :label="promptLabel"
      :on-enhance="enhanceField('prompt')"
      :on-revert="() => revertField('prompt')"
      :enhancing="Boolean(enhancing)"
      :disabled="disabled"
      @change="emit('update:modelValue', $event)"
    />

    <p v-if="submitError" class="chai-composer__error" role="alert"><ErrorIcon />{{ submitError }}</p>
    <p v-if="voiceInput && voiceState.status === 'error'" class="chai-composer__error" role="alert"><ErrorIcon />{{ voiceState.error }}</p>

    <div class="chai-composer__controls">
      <div class="chai-composer__controls-start">
        <AttachMenu
          v-if="menuItems.length > 0 || extraMenuItems.length > 0"
          :items="menuItems"
          :extra-items="extraMenuItems"
          :images-only="view.editing"
          :disabled="disabled"
          :placement="menuPlacement"
          @select="onMenuSelect($event)"
          @files="onFiles"
        />

        <Chip
          v-for="u in view.pickedUseCases"
          :key="u.kind"
          :label="u.label"
          :removable="Boolean(multiSelectUseCases ? props['onUpdate:useCases'] : onClearUseCase)"
          :disabled="disabled"
          @remove="removeUseCase(u)"
        />

        <Chip
          v-for="chip in contextChips"
          :key="`context-${chip.id}`"
          :label="chip.label"
          :icon="chip.icon"
          context
          :removable="Boolean(chip.onRemove)"
          :disabled="disabled"
          @remove="chip.onRemove?.()"
        />

        <!-- One Model menu, or one per use case with multi-use-case select. The auto-select switch lives inside each, so with it shown the trigger stays enabled: it's the only way back to the switch. -->
        <SearchMenu
          v-for="menu in view.canPickModel ? view.modelMenus : []"
          :key="menu.key"
          :placement="menuPlacement"
          :options="menu.options"
          :value="menu.value"
          :multiple="menu.multiple"
          :toggle-header="
            showAutoSelectToggle && view.offersAutoSelect
              ? { label: 'Auto-select model', value: view.autoSelectModel, onChange: toggleAutoSelect }
              : undefined
          "
          :trigger-label="menu.triggerLabel"
          :menu-label="menu.menuLabel"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled || (view.autoSelectModel && !(showAutoSelectToggle && view.offersAutoSelect))"
          :panel-width="showAutoSelectToggle && view.offersAutoSelect ? 320 : undefined"
          @select="pickModel(menu, $event.id)"
        />

        <SearchMenu
          :placement="menuPlacement"
          v-if="view.showAspectRatio && view.aspectOptions.length > 0 && props['onUpdate:aspectRatio']"
          :options="view.aspectOptions.map((o) => ({ id: o.value, label: o.label }))"
          :value="view.offeredAspect"
          :trigger-label="view.selectedAspect?.label ?? 'Aspect ratio'"
          menu-label="Aspect ratio"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled"
          @select="pickOption('aspect_ratio', $event.id, () => props['onUpdate:aspectRatio']?.($event.id))"
        />

        <SearchMenu
          :placement="menuPlacement"
          v-if="view.voiceOptions.length > 0 && props['onUpdate:speechVoice']"
          v-bind="voiceMenuOptions"
          :value="view.offeredVoice"
          :trigger-label="view.voiceTriggerLabel"
          menu-label="Voice"
          :searchable="view.voiceOptions.length > view.searchableAt"
          trigger-variant="text"
          :disabled="disabled"
          @select="pickOption('voice', $event.id, () => props['onUpdate:speechVoice']?.($event.id))"
        />

        <SearchMenu
          :placement="menuPlacement"
          v-if="view.genreOptions.length > 0 && props['onUpdate:genres']"
          :options="view.genreOptions.map(toMenuOption)"
          :value="view.offeredGenres"
          multiple
          :trigger-label="view.genreTriggerLabel"
          menu-label="Genre"
          :searchable="view.genreOptions.length > view.searchableAt"
          trigger-variant="text"
          :disabled="disabled"
          @select="pickOption('genre', $event.id, () => props['onUpdate:genres']?.(view.toggledGenres($event.id)))"
        />

        <SearchMenu
          :placement="menuPlacement"
          v-if="view.frameRateOptions.length > 0 && props['onUpdate:frameRate']"
          :options="view.frameRateOptions.map((r) => ({ id: String(r), label: `${r}fps` }))"
          :value="view.offeredFrameRate == null ? null : String(view.offeredFrameRate)"
          :trigger-label="view.offeredFrameRate == null ? 'Frame rate' : `${view.offeredFrameRate}fps`"
          menu-label="Frame rate"
          :searchable="false"
          trigger-variant="text"
          :disabled="disabled"
          @select="pickOption('frame_rate', $event.id, () => props['onUpdate:frameRate']?.(Number($event.id)))"
        />
      </div>

      <div class="chai-composer__controls-end">
      <VoiceButton
        v-if="voiceInput"
        :voice="voice"
        :state="voiceState"
        :disabled="disabled"
        :on-start="onVoiceStart"
      />
      <!-- MD3's md-fab has no disabled state of its own; Chai's unfilled-until-ready look comes from `data-ready` in style.css. `label=""` keeps it a plain icon FAB.
           Hidden while a recording is made or transcribed: the transcript is sent once it's in the prompt to check. -->
      <md-fab
        v-if="!(voiceInput && (voiceState.status === 'recording' || voiceState.status === 'transcribing'))"
        class="chai-composer__submit"
        size="small"
        variant="secondary"
        label=""
        :data-ready="view.showStop || !view.isSubmitDisabled || undefined"
        :data-error="Boolean(submitError) || undefined"
        :data-stop="view.showStop || undefined"
        :aria-label="view.showStop ? 'Stop' : submitError ? 'Retry' : 'Submit'"
        :aria-disabled="view.showStop ? 'false' : submitting || view.isSubmitDisabled ? 'true' : 'false'"
        @click="onSubmitClick"
      >
        <span slot="icon"><StopIcon v-if="view.showStop" /><RetryIcon v-else-if="submitError" /><ArrowForwardIcon v-else /></span>
      </md-fab>
      </div>
    </div>
  </div>
</template>
