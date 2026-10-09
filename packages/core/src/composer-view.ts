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
import type { MediaKind, ModelOption, ParameterOption } from "./types.js";

export type ComposerAttachMenuAction = "add-media" | "create-image" | "create-video" | "edit-media";

/** The `+` menu, in order. "Add media" is the only item with a divider after it. */
export const COMPOSER_ATTACH_MENU_ITEMS: { action: ComposerAttachMenuAction; label: string; divider?: boolean }[] = [
  { action: "add-media", label: "Add media", divider: true },
  { action: "create-image", label: "Create image" },
  { action: "create-video", label: "Create video" },
  { action: "edit-media", label: "Edit image" },
];

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
  modelsByKind?: Partial<Record<MediaKind, ModelOption[]>>;
  multiSelectModels?: boolean;
  modelIds?: string[];
  models?: ModelOption[];
  modelId?: string | null;
  onModelChange?: unknown;
  onModelIdsChange?: unknown;
  autoSelectModel?: boolean;
  aspectRatios?: ParameterOption<string>[];
  aspectRatio?: string | null;
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
    autoSelectModel = false,
    aspectRatios,
    aspectRatio = null,
    submitError = null,
    submitting = false,
    regions = [],
    disabled = false,
  } = props;

  // What the person picked, and what actually runs: with nothing picked, the
  // builder's default use case (a text request unless they chose otherwise).
  const pickedUseCases = multiSelectUseCases ? useCases : useCase ? [useCase] : [];
  const activeUseCases = pickedUseCases.length > 0 ? pickedUseCases : [defaultUseCase];
  // An edit needs an image, then a change: a prompt for the whole image, a
  // region with its own instruction, or both.
  const editing = activeUseCases.some((u) => u.edit);
  const hasImage = attachments.some((a) => a.kind === "image");
  const hasContent = editing
    ? hasImage && (value.trim().length > 0 || regions.length > 0)
    : value.trim().length > 0 || attachments.length > 0;
  const placeholder =
    props.placeholder ??
    (editing
      ? hasImage
        ? "Describe a change across the whole image, or leave this empty"
        : "Attach an image to edit"
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
  // One menu section per use case with multi-use-case select; otherwise one flat roster.
  const modelSections = (multiSelectUseCases ? activeUseCases : activeUseCases.slice(0, 1))
    .map((u) => ({ label: multiSelectUseCases ? u.label : "", kind: u.kind, ...rosterFor(u) }))
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
  // With a Model menu, a submit needs a model: one picked, or auto-select to pick it.
  const needsModel = canPickModel && modelSections.length > 0 && !autoSelectModel && pickedModelIds.length === 0;
  const isSubmitDisabled = submitError ? disabled : (props.submitDisabled ?? (disabled || !hasContent || needsModel));

  // An edit keeps the source image's shape.
  const showAspectRatio = activeUseCases.some((u) => !u.edit && (u.kind === "image" || u.kind === "video"));
  // Only ratios every model that might run takes: the picked ones, or with
  // none picked (or auto-select on) the whole list, so whichever runs can
  // honor it. A model with no `aspectRatios` sets its own shape: no menu.
  const ratioModels = pickedModels.length > 0 && !autoSelectModel ? pickedModels : allModels;
  const sharedRatios =
    ratioModels.reduce<string[] | null>((shared, m) => (shared ?? m.aspectRatios ?? []).filter((r) => m.aspectRatios?.includes(r)), null) ??
    [];
  const aspectOptions = aspectRatios
    ? aspectRatios.filter((o) => sharedRatios.includes(o.value))
    : sharedRatios.map((r) => ({ value: r, label: r }));
  // A pick the current models don't take is shown as unpicked and never sent.
  const offeredAspect = showAspectRatio && aspectOptions.some((o) => o.value === aspectRatio) ? aspectRatio : null;
  const selectedAspect = aspectOptions.find((o) => o.value === offeredAspect) ?? null;

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
    useCaseKey: pickedUseCases.map((u) => `${u.kind}${u.edit ? ":edit" : ""}`).join(","),
    activeUseCases,
    editing,
    isSubmitDisabled,
    placeholder,
    showStop,
    multiModel,
    modelSections,
    pickedModelIds,
    canPickModel,
    modelTriggerLabel,
    showAspectRatio,
    aspectOptions,
    offeredAspect,
    selectedAspect,
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
    }),
  };
}

export type ComposerView = ReturnType<typeof composerView>;

/** The `+` menu items that can work: "Add media" needs somewhere to put files, the use-case items a handler. */
export function composerAttachMenuItems(
  actions: ComposerAttachMenuAction[] | undefined,
  { canAddMedia, canSelect }: { canAddMedia: boolean; canSelect: boolean }
) {
  return COMPOSER_ATTACH_MENU_ITEMS.filter(
    (item) =>
      (actions ?? COMPOSER_ATTACH_MENU_ITEMS.map((i) => i.action)).includes(item.action) &&
      (item.action === "add-media" ? canAddMedia : canSelect)
  );
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
