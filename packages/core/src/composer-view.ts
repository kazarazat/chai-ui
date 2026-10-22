/**
 * What the Composer component shows and submits, worked out from its props:
 * the same in every framework binding. Pure; nothing here renders.
 */
import type { ComposerAttachment, ComposerSelection, ComposerSubmitPayload, ComposerUseCase } from "./composer.js";
import { uniqueId } from "./unique-id.js";
import { TEXT_USE_CASE } from "./composer.js";
import { readMediaFiles } from "./media-analyzer.js";
import type { EditRegion } from "./region-edit.js";
import { deriveGenerationUseCase } from "./run.js";
import { suggestedModels } from "./suggested-models.js";
import type { ModelOption, OutputKind, ParameterOption } from "./types.js";

/** Which prompt field an Enhance click is for: the bar's prompt, or a world's environment or character. */
export type ComposerPromptField = "prompt" | "environment" | "character";

export type ComposerAttachMenuAction =
  | "add-media"
  | "create-image"
  | "create-video"
  | "create-world"
  | "edit-image"
  | "create-speech"
  | "create-music";

/**
 * The `+` menu, in order, in groups: attaching, then visual media, then
 * audio. A divider separates two groups that both have items showing. An
 * `optIn` item shows only when `attachMenuActions` lists it.
 */
export const COMPOSER_ATTACH_MENU_ITEMS: {
  action: ComposerAttachMenuAction;
  label: string;
  group: "attach" | "visual" | "audio";
  optIn?: boolean;
}[] = [
  { action: "add-media", label: "Add media", group: "attach" },
  { action: "create-image", label: "Create image", group: "visual" },
  { action: "create-video", label: "Create video", group: "visual" },
  // No suggested world models or shipped world engine yet: a builder adds
  // this with their own models and `engineByKind.world`.
  { action: "create-world", label: "Create world", group: "visual", optIn: true },
  { action: "edit-image", label: "Edit image", group: "visual" },
  // No suggested audio models yet: a builder adds these with their own
  // models and `engineByKind.audio`.
  { action: "create-speech", label: "Create speech", group: "audio", optIn: true },
  { action: "create-music", label: "Create music", group: "audio", optIn: true },
];

/**
 * With `multiSelectUseCases`: whether a use case can run alongside others.
 * Only Image and Video share a prompt (and one Enhance rewrite): music,
 * speech and a world each read the prompt differently, and an edit works
 * on one image. Every other use case runs alone.
 */
export function combinesWithOthers(useCase: ComposerUseCase): boolean {
  return !useCase.edit && (useCase.kind === "image" || useCase.kind === "video");
}

/**
 * The picked use cases after picking `picked` from the `+` menu with
 * `multiSelectUseCases`: Image and Video join each other (a pick of the
 * same kind swaps in place); any other use case replaces the rest, and is
 * replaced by the next pick.
 */
export function nextUseCases(current: ComposerUseCase[], picked: ComposerUseCase): ComposerUseCase[] {
  if (!combinesWithOthers(picked)) return [picked];
  const rest = current.filter(combinesWithOthers);
  return rest.some((u) => u.kind === picked.kind)
    ? rest.map((u) => (u.kind === picked.kind ? picked : u))
    : [...rest, picked];
}

/**
 * Past this length a rewritten prompt appears at once: a long reveal reads
 * as sluggish, and a long prompt is when a person wants the result now.
 */
export const MAX_ANIMATE_ENHANCE_LENGTH = 260;

/** How long the Enhance reveal takes: time-driven, between 300ms and 900ms. */
export function enhanceRevealDurationMs(charCount: number): number {
  return Math.min(900, Math.max(300, charCount * 6));
}

/** The Composer props `composerView` reads. Callbacks only matter by being there. */
export interface ComposerViewInput {
  value: string;
  placeholder?: string;
  attachments?: ComposerAttachment[];
  useCase?: ComposerUseCase | null;
  defaultUseCase?: ComposerUseCase;
  multiSelectUseCases?: boolean;
  useCases?: ComposerUseCase[];
  modelsByKind?: Partial<Record<OutputKind, ModelOption[]>>;
  multiSelectModels?: boolean;
  modelIds?: string[];
  models?: ModelOption[];
  modelId?: string | null;
  onModelChange?: unknown;
  onModelIdsChange?: unknown;
  autoSelectModel?: boolean;
  aspectRatios?: ParameterOption<string>[];
  aspectRatio?: string | null;
  /** A world's character field. */
  character?: string;
  frameRate?: number | null;
  /** Create speech's voice. */
  speechVoice?: string | null;
  /** Create music's genres. */
  genres?: string[];
  submitError?: string | null;
  submitDisabled?: boolean;
  submitting?: boolean;
  onAbort?: unknown;
  regions?: EditRegion[];
  disabled?: boolean;
}

export function composerView(props: ComposerViewInput) {
  const {
    value,
    attachments = [],
    useCase = null,
    defaultUseCase = TEXT_USE_CASE,
    multiSelectUseCases = false,
    useCases = [],
    modelsByKind,
    multiSelectModels = false,
    modelIds = [],
    models,
    modelId = null,
    autoSelectModel: autoSelectRequested = false,
    aspectRatios,
    aspectRatio = null,
    character = "",
    frameRate = null,
    speechVoice = null,
    genres = [],
    submitError = null,
    submitting = false,
    regions = [],
    disabled = false,
  } = props;

  // Auto-select is off with multi-use-case select: each use case's model
  // is picked by hand, so one switch never stands for several menus.
  const autoSelectModel = autoSelectRequested && !multiSelectUseCases;

  // What the person picked, and what actually runs: with nothing picked, the
  // builder's default use case (a text request unless they chose otherwise).
  // A list that breaks `nextUseCases`' rule runs only its last pick.
  const listed = multiSelectUseCases ? useCases : useCase ? [useCase] : [];
  const pickedUseCases = listed.length > 1 && !listed.every(combinesWithOthers) ? listed.slice(-1) : listed;
  const activeUseCases = pickedUseCases.length > 0 ? pickedUseCases : [defaultUseCase];
  // An edit needs an image, then a change: a prompt for the whole image, a
  // region with its own instruction, or both.
  const editing = activeUseCases.some((u) => u.edit);
  // A world takes two prompts: the environment (`value`, required) and the
  // character the person plays (optional). An image can start the world,
  // but the environment is still needed.
  const world = activeUseCases.some((u) => u.kind === "world");
  const audio = activeUseCases.find((u) => u.kind === "audio")?.audio;
  const hasImage = attachments.some((a) => a.kind === "image");
  const hasContent = editing
    ? hasImage && (value.trim().length > 0 || regions.length > 0)
    : world
      ? value.trim().length > 0
      : value.trim().length > 0 || attachments.length > 0;
  const placeholder =
    props.placeholder ??
    (editing
      ? hasImage
        ? "Describe a change across the whole image, or leave this empty"
        : "Attach an image to edit"
      : world
        ? attachments.length > 0
          ? "Describe the world, and how to use the attached media"
          : "Describe the world and how you move through it"
        : audio === "speech"
          ? "Type the words to speak"
          : audio === "music"
            ? "Describe the music to create"
            : "Describe media to create");
  // The stop icon only appears with somewhere for its click to go.
  const showStop = submitting && Boolean(props.onAbort);

  const multiModel = multiSelectModels || multiSelectUseCases;
  const rawPickedIds = multiModel ? modelIds : modelId ? [modelId] : [];
  // The app's list for a use case, or Chai's suggested models when it gave none.
  const rosterFor = (u: ComposerUseCase): { options: ModelOption[]; suggested: boolean } => {
    const given = multiSelectUseCases ? modelsByKind?.[u.kind] : models;
    if (given) return { options: given, suggested: false };
    return { options: suggestedModels(u.edit ? "image-edit" : deriveGenerationUseCase(u, attachments)), suggested: true };
  };
  // One roster per use case with multi-use-case select (each gets its own menu); otherwise one.
  const modelSections = (multiSelectUseCases ? activeUseCases : activeUseCases.slice(0, 1))
    .map((u) => ({ label: multiSelectUseCases ? u.label : "", kind: u.kind, useCase: u, ...rosterFor(u) }))
    .filter((s) => s.options.length > 0);
  const allModels = modelSections.flatMap((s) => s.options);
  // No menu that can't change anything: without its handler, the Model menu hides.
  const canPickModel = Boolean(multiModel ? props.onModelIdsChange : props.onModelChange);
  // A pick that isn't in the current list (e.g. the edit model after leaving
  // edit mode) is shown as unpicked and never submitted. With no list at
  // all, the app's pick is passed through as given. The Composer never picks
  // for the person: with a Model menu, nothing is picked until they pick or
  // turn on auto-select. Only with no menu (nothing the person could pick
  // with) does a suggested list's first model run.
  const validPicks = allModels.length > 0 ? rawPickedIds.filter((id) => allModels.some((m) => m.id === id)) : rawPickedIds;
  const pickedModelIds =
    validPicks.length > 0 || autoSelectModel || canPickModel
      ? validPicks
      : modelSections.filter((s) => s.suggested).map((s) => s.options[0]!.id);
  const pickedModels = allModels.filter((m) => pickedModelIds.includes(m.id));
  const modelTriggerLabel =
    pickedModels.length > 1
      ? `${pickedModels.length} models`
      : (pickedModels[0]?.label ?? (autoSelectModel ? "Auto-select" : multiModel ? "Select models" : "Select model"));
  const picksIn = (s: (typeof modelSections)[number]) => pickedModels.filter((m) => s.options.some((o) => o.id === m.id));
  // With a Model menu, a submit needs a model for every use case: picked,
  // or auto-select to pick it. Never an engine default nobody chose.
  const needsModel = canPickModel && !autoSelectModel && modelSections.some((s) => picksIn(s).length === 0);

  // The Model menus: one per use case with multi-use-case select, each
  // picking one model unless `multiSelectModels` allows several.
  const modelMenus = multiSelectUseCases
    ? modelSections.map((s) => {
        const picks = picksIn(s);
        const multiple = multiSelectModels;
        return {
          key: s.kind,
          options: s.options,
          multiple,
          value: multiple ? picks.map((m) => m.id) : (picks[0]?.id ?? null),
          menuLabel: `${s.useCase.label} ${multiple ? "models" : "model"}`,
          triggerLabel:
            picks.length > 1
              ? `${picks.length} models`
              : (picks[0]?.label ?? (autoSelectModel ? "Auto-select" : `${s.useCase.label} model`)),
          /** The model ids after a row click: this use case's pick replaced, or with several allowed, toggled. */
          next: (id: string) =>
            multiple
              ? modelIds.includes(id)
                ? modelIds.filter((m) => m !== id)
                : [...modelIds, id]
              : [...modelIds.filter((m) => !s.options.some((o) => o.id === m)), id],
        };
      })
    : modelSections.slice(0, 1).map((s) => ({
        key: s.kind,
        options: s.options,
        multiple: multiModel,
        value: multiModel ? pickedModelIds : modelId,
        menuLabel: multiModel ? "Select models" : "Select model",
        triggerLabel: modelTriggerLabel,
        next: (id: string) => (modelIds.includes(id) ? modelIds.filter((m) => m !== id) : [...modelIds, id]),
      }));
  const isSubmitDisabled = submitError ? disabled : (props.submitDisabled ?? (disabled || !hasContent || needsModel));

  // The models a control is for: only those of the use cases it applies to,
  // so with Image and Video picked together, the Aspect ratio menu offers
  // what both take, and no other use case's models empty a menu. `offered` is
  // what might run: the picks, or with none picked (or auto-select on) the
  // whole list.
  const modelsFor = (applies: (u: ComposerUseCase) => boolean) => {
    const ids = new Set(modelSections.filter((s) => applies(s.useCase)).flatMap((s) => s.options.map((o) => o.id)));
    const picked = pickedModels.filter((m) => ids.has(m.id));
    return { picked, offered: picked.length > 0 && !autoSelectModel ? picked : allModels.filter((m) => ids.has(m.id)) };
  };

  // An edit keeps the source image's shape.
  const isVisual = (u: ComposerUseCase) => !u.edit && (u.kind === "image" || u.kind === "video");
  const showAspectRatio = activeUseCases.some(isVisual);
  // Only ratios every model that might run takes, so whichever runs can
  // honor it. A model with no `aspectRatios` sets its own shape: no menu.
  const ratioModels = modelsFor(isVisual).offered;
  const sharedRatios =
    ratioModels.reduce<string[] | null>((shared, m) => (shared ?? m.aspectRatios ?? []).filter((r) => m.aspectRatios?.includes(r)), null) ??
    [];
  const aspectOptions = aspectRatios
    ? aspectRatios.filter((o) => sharedRatios.includes(o.value))
    : sharedRatios.map((r) => ({ value: r, label: r }));
  // A pick the current models don't take is shown as unpicked and never sent.
  const offeredAspect = showAspectRatio && aspectOptions.some((o) => o.value === aspectRatio) ? aspectRatio : null;
  const selectedAspect = aspectOptions.find((o) => o.value === offeredAspect) ?? null;

  // A world's frame rate works like aspect ratio: only rates every model
  // that might run takes, and a pick outside them is never sent.
  const frameRateOptions = world
    ? (modelsFor((u) => u.kind === "world").offered.reduce<number[] | null>((shared, m) => (shared ?? m.frameRates ?? []).filter((r) => m.frameRates?.includes(r)), null) ?? [])
    : [];
  const offeredFrameRate = frameRate != null && frameRateOptions.includes(frameRate) ? frameRate : null;

  // A voice belongs to one model: the Voice menu shows once exactly one is
  // picked, never under auto-select (no model yet to take voices from).
  const speechPicks = modelsFor((u) => u.audio === "speech").picked;
  const voiceModel = audio === "speech" && !autoSelectModel && speechPicks.length === 1 ? speechPicks[0] : undefined;
  const voiceOptions = voiceModel?.voices ?? [];
  const offeredVoice = voiceOptions.some((v) => v.value === speechVoice) ? speechVoice : null;
  const voiceSections = voiceOptions.some((v) => v.group)
    ? [...new Set(voiceOptions.map((v) => v.group ?? ""))].map((label) => ({
        label,
        options: voiceOptions.filter((v) => (v.group ?? "") === label),
      }))
    : null;

  // Genres every picked music model lists, once one is picked. A pick the
  // current models don't list is shown as unpicked and never sent.
  const genreModels = audio === "music" && !autoSelectModel ? modelsFor((u) => u.audio === "music").picked : [];
  const genreOptions =
    genreModels.length > 0
      ? (genreModels.reduce<ParameterOption<string>[] | null>(
          (shared, m) => (shared ?? m.genres ?? []).filter((g) => m.genres?.some((o) => o.value === g.value)),
          null
        ) ?? [])
      : [];
  const offeredGenres = genres.filter((g) => genreOptions.some((o) => o.value === g));
  const genreTriggerLabel =
    offeredGenres.length === 0
      ? "Genre"
      : offeredGenres.length === 1
        ? genreOptions.find((o) => o.value === offeredGenres[0])!.label
        : `${offeredGenres.length} genres`;

  const selections = (): ComposerSelection[] =>
    activeUseCases.map((u) => ({
      useCase: u,
      models: rosterFor(u).options,
      modelIds: multiSelectUseCases ? pickedModelIds.filter((id) => rosterFor(u).options.some((m) => m.id === id)) : pickedModelIds,
    }));

  return {
    pickedUseCases,
    /**
     * Which use cases are picked, as one string. When it changes, a Composer
     * whose end user owns the auto-select switch turns auto-select off: it
     * belongs to the Model menu it was turned on in, so a new use case
     * starts with its model picked by hand.
     */
    useCaseKey: pickedUseCases.map((u) => `${u.kind}${u.edit ? ":edit" : ""}${u.audio ? `:${u.audio}` : ""}`).join(","),
    activeUseCases,
    editing,
    isSubmitDisabled,
    placeholder,
    showStop,
    multiModel,
    modelSections,
    /** The Model menus to render: one, or with multi-use-case select one per use case. */
    modelMenus,
    /** Whether auto-select is on: never with multi-use-case select. */
    autoSelectModel,
    /** Whether a Model menu can offer the auto-select switch: not with multi-use-case select. */
    offersAutoSelect: !multiSelectUseCases,
    pickedModelIds,
    canPickModel,
    modelTriggerLabel,
    showAspectRatio,
    aspectOptions,
    offeredAspect,
    selectedAspect,
    world,
    /**
     * What an Enhance click rewrites for: the active use case, derived like
     * a submit's `mode` ("text-to-text" with no use case picked, "vision"
     * with media attached, "image-edit" while editing). Undefined for a world.
     */
    enhanceMode: editing ? ("image-edit" as const) : deriveGenerationUseCase(activeUseCases[0], attachments),
    /**
     * Why submit can't go yet, shown under the environment: there's
     * something to send (a character or an attachment) but no environment.
     */
    environmentHint:
      world && !value.trim() && (character.trim().length > 0 || attachments.length > 0)
        ? "Add an environment to create a world"
        : null,
    characterPlaceholder: "Describe who you play as, or leave this empty",
    frameRateOptions,
    offeredFrameRate,
    /** Create speech's Voice menu: the one picked model's voices, in sections when they have groups. */
    voiceOptions,
    voiceSections,
    offeredVoice,
    voiceTriggerLabel: voiceOptions.find((v) => v.value === offeredVoice)?.label ?? "Voice",
    /** Create music's Genre menu, several at once. */
    genreOptions,
    offeredGenres,
    genreTriggerLabel,
    /** The genres after a row click: that one toggled. */
    toggledGenres: (value: string) =>
      offeredGenres.includes(value) ? offeredGenres.filter((g) => g !== value) : [...offeredGenres, value],
    /** Past this many options, a Voice or Genre menu gets a search field. */
    searchableAt: 10,
    /** The model ids after a row click: the one picked, or with multi-select that one toggled. */
    toggledModelIds: (id: string) => (modelIds.includes(id) ? modelIds.filter((m) => m !== id) : [...modelIds, id]),
    /** Everything a submit sends. */
    payload: (): ComposerSubmitPayload => ({
      value,
      attachments,
      useCase: activeUseCases[0]!,
      modelId: pickedModelIds[0] ?? null,
      aspectRatio: offeredAspect,
      selections: selections(),
      autoSelectModel,
      regions: editing ? regions : [],
      ...(world && { character, frameRate: offeredFrameRate }),
      ...(audio === "speech" && { speechVoice: offeredVoice }),
      ...(audio === "music" && { genres: offeredGenres }),
    }),
  };
}

export type ComposerView = ReturnType<typeof composerView>;

/**
 * The `+` menu items that can work: "Add media" needs somewhere to put
 * files, the use-case items a handler. With no `actions`, every item that
 * isn't opt-in. `divider` marks the last showing item of a group with
 * another group after it.
 */
export function composerAttachMenuItems(
  actions: ComposerAttachMenuAction[] | undefined,
  { canAddMedia, canSelect }: { canAddMedia: boolean; canSelect: boolean }
) {
  const shown = COMPOSER_ATTACH_MENU_ITEMS.filter(
    (item) =>
      (actions ? actions.includes(item.action) : !item.optIn) &&
      (item.action === "add-media" ? canAddMedia : canSelect)
  );
  return shown.map((item, i) => ({ ...item, divider: i < shown.length - 1 && shown[i + 1]!.group !== item.group }));
}

/**
 * The attachments after picking files: each image, video or audio file
 * added in the order picked. Editing works on one image, so its first image
 * replaces what's there (and with none, every file is unsupported).
 */
export async function composerAttachmentsFromFiles(
  files: Iterable<File>,
  current: ComposerAttachment[],
  editing: boolean
): Promise<{ attachments: ComposerAttachment[] | null; unsupported: string[] }> {
  const list = [...files];
  if (editing) {
    const image = list.find((f) => f.type.startsWith("image/"));
    if (!image) return { attachments: null, unsupported: list.map((f) => f.name) };
    const { media, unsupported } = await readMediaFiles([image]);
    return { attachments: media.length > 0 ? media.map((m) => ({ ...m, id: uniqueId() })) : null, unsupported };
  }
  const { media, unsupported } = await readMediaFiles(list);
  return { attachments: [...current, ...media.map((m) => ({ ...m, id: uniqueId() }))], unsupported };
}
