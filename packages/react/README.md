<p align="center">
  <a href="https://chai-ui.com"><img src="https://chai-ui.com/chai-wordmark.svg" alt="Chai UI" width="220" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chai-ui/react"><img src="https://img.shields.io/npm/v/@chai-ui/react?label=npm&color=009747" alt="npm version" /></a>
  <a href="https://github.com/kazarazat/chai-ui/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-009747" alt="MIT license" /></a>
  <a href="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml"><img src="https://github.com/kazarazat/chai-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/kazarazat/chai-ui"><img src="https://codecov.io/gh/kazarazat/chai-ui/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://chai-ui.com/docs/"><img src="https://img.shields.io/badge/docs-chai--ui.com-009747" alt="Docs" /></a>
</p>

# @chai-ui/react

React components for the input and output surfaces of generative-media
apps. Everything here is controlled — you own the state, these components
render it and tell you when it changes.

Building with it, or pointing a coding agent at it? Read
[`DESIGN.md`](./DESIGN.md) (shipped in the package) for the usage rules:
which component to pick, which tokens exist, the built-in AI states, and
what not to build.

Chai's components support WCAG 2.2 AA: tested with axe and automated
keyboard and focus checks, not by hand with a screen reader. DESIGN.md §6
has the details. Focus rings are visible by default, as WCAG requires.
`data-chai-focus-ring="hidden"` on an ancestor hides them, for preview or
showcase surfaces only. `Composer`'s `promptLabel` names the prompt field
(default: the placeholder), and `ResultCard`'s `altText` sets image alt
text (default: the prompt).

## Quick start: `Composer`

`Composer` is the `bar`-layout input surface: a prompt field, an attach
menu, a use-case chip, model/aspect-ratio pickers, and submit — all driven
by which props you supply, not by four separate components.

```tsx
import { useState } from "react";
import "@chai-ui/tokens/css";
import "@chai-ui/react/style.css";
import { Composer, type ComposerAttachment, type ComposerSubmitPayload } from "@chai-ui/react";

function App() {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  function handleSubmit(payload: ComposerSubmitPayload) {
    // payload = { value, attachments, useCase, modelId, aspectRatio } —
    // everything Composer tracks, assembled for you. Send it to whichever
    // model/provider you've set up; Composer never calls one itself.
    console.log(payload);
  }

  return (
    <Composer
      value={value}
      onChange={setValue}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      onSubmit={handleSubmit}
    />
  );
}
```

That's the minimal case — no model picker, no aspect ratio, no attach
capability beyond the default file picker. Every other control is additive:

```tsx
<Composer
  value={value}
  onChange={setValue}
  attachments={attachments}
  onAttachmentsChange={setAttachments}
  // A use-case chip + model/aspect-ratio pickers only appear once `useCase`
  // is set — wire it from the attach menu's own picks, or set it yourself.
  useCase={useCase}
  onClearUseCase={() => setUseCase(null)}
  onAttachMenuSelect={(action) => {
    if (action === "create-image") setUseCase({ kind: "image", label: "Image" });
  }}
  // The Model menu lists Chai's suggested models for the use case, with the
  // first picked, unless you pass your own `models` (see "Suggested models").
  // It shows only with `onModelChange`; without it the first model still runs.
  modelId={modelId}
  onModelChange={setModelId}
  // An "Auto-select model" switch appears at the top of the model menu so
  // the end user can flip it — omit `showAutoSelectToggle` to keep it a
  // fixed, builder-only setting with no visible control instead.
  autoSelectModel={autoSelectModel}
  showAutoSelectToggle
  onAutoSelectModelChange={setAutoSelectModel}
  // The Aspect ratio menu offers what the selected models take. Suggested
  // models carry their `aspectRatios`; give your own models theirs, e.g.
  // ["1:1", "16:9", "9:16"]. A model without them (image-to-video follows
  // the input image) shows no menu.
  aspectRatio={aspectRatio}
  onAspectRatioChange={setAspectRatio}
  // Omit onEnhance entirely to hide the "optimize prompt" button — e.g.
  // before you've wired an engine that can actually run the rewrite.
  onEnhance={(currentValue) => runEnhance(currentValue).then(setValue)}
  onSubmit={handleSubmit}
/>
```

The full prop list — including `attachments`' file-reading behavior,
`onUnsupportedFile`, and `disabled`/`submitDisabled` — is documented as
JSDoc directly on `ComposerProps` in `src/Composer.tsx`; every prop and
event follows the same `value`/`onChange` shape used everywhere else in
this package.

See the [Composer page on the docs site](https://chai-ui.com/docs/components/composer-bar)
for a live example with every opt-in feature.

### No use case picked: a text request

A prompt typed with no use case picked is a text request
(`TEXT_USE_CASE`): it gets a text reply rather than doing nothing. That's
how to use the Composer as a plain chat bar for an LLM:

- **The model:** `useComposer` sends it to `textEngine` with `textModel`
  when you set them, otherwise to `ChaiProvider`'s reasoning model
  (default Claude Opus 5 on OpenRouter). Without a `ChaiProvider` or a
  `textEngine`, a mock text engine answers, so wrap your app in
  `<ChaiProvider>` for real replies.
- **No Model menu:** the suggested lists cover image and video only, so a
  text request shows no Model menu. To offer a choice of text models, pass
  your own `models`.
- **The reply streams** into the `ResultCard` as it's written, and
  `cancel()` stops it, keeping what has arrived.

```tsx
<ChaiProvider>
  <Composer value={value} onChange={setValue} onSubmit={submit} submitting={busy} onAbort={cancel} />
  {run && <ResultCard results={run.results} prompt={run.request.prompt} onAction={() => {}} />}
</ChaiProvider>
```

For an app that's mostly about images, set the default instead; it's
never shown as a chip, and it brings the suggested image models and the
Aspect ratio menu:

```tsx
<Composer defaultUseCase={{ kind: "image", label: "Image" }} … />
```

### Several models, several use cases (builder opt-ins, off by default)

```tsx
// Several models: each produces its own result, paged inside one ResultCard.
<Composer multiSelectModels modelIds={modelIds} onModelIdsChange={setModelIds} models={models} … />

// Several use cases at once (at most one per kind): the Model menu shows a
// section per picked use case, and onSubmit gets one selection per use case.
<Composer
  multiSelectUseCases
  useCases={useCases}
  onUseCasesChange={setUseCases}
  modelsByKind={{ image: imageModels, video: videoModels }}
  modelIds={modelIds}
  onModelIdsChange={setModelIds}
  …
/>
```

Either way `onSubmit` receives `selections`: one `{ useCase, modelIds, models }`
entry per use case.

With `autoSelectModel` on, the trigger reads "Auto-select" and
`useComposer` picks the model at submit: the reasoning model reads the
prompt and media and chooses from that use case's `models`. When the end
user owns the switch (`showAutoSelectToggle`), auto-select belongs to the
use case it was turned on for: picking another use case calls
`onAutoSelectModelChange(false)`, so the new one's model is picked by hand. Pass
`onModelChange` (or `onModelIdsChange`) to the hook too, so the trigger
shows the pick:

```tsx
const { submit, routing } = useComposer({ engine, onModelChange: setModelId });
```

If routing can't run (no `ChaiProvider`, a failed reasoning call, an
unlisted reply), the request runs on the first listed model and
`onRoutingFallback` says why.

## What else this package ships

- **`MediaAnalyzer`** — drop in an image, video, or audio clip and get a
  generation-ready prompt back, with kind-aware model menus (suggested
  OpenRouter models unless you pass your own) and a prompt length picker. Wire it with `useMediaAnalyzer()`, which sends the media
  to `ChaiProvider`'s reasoning model and returns the prompt:
  `onSubmit={submit} submitting={analyzing} submitError={error}`.
- **`ResultCard`** — renders one prompt's generated results (image, video,
  audio, or text) with like/dislike/retry/download/share, a configurable
  "more" menu, pagination across multiple results, and an info flip showing
  the prompt and model metadata. Live example:
  [chai-ui.com/docs/components/result-card](https://chai-ui.com/docs/components/result-card).
- **`EditCard`** — edit an attached image by marking regions on it, each
  with its own instruction, then page through the edits as versions. See
  "Editing an image" below.
- **Primitives** (`src/primitives/`) — `Toggle` (an MD3 switch),
  `SearchMenu` (the model/option menu behind every picker — Chai's own rather than Material's `<md-menu>`; DESIGN.md §3 says why), and
  `Pagination` (a progress-style pager any paginated surface can reuse).
  The components are built from these; they're also exported directly if
  you're assembling your own layout.

## Suggested models

You don't have to write model lists. Chai ships suggested lists, checked
against each provider's own catalog, and the components use them when you
pass none:

| Use case | Export | Provider |
|---|---|---|
| Create image | `SUGGESTED_IMAGE_MODELS` | Fal |
| Create video from a prompt | `SUGGESTED_TEXT_TO_VIDEO_MODELS` | Fal |
| Create video from an image | `SUGGESTED_IMAGE_TO_VIDEO_MODELS` | Fal |
| Edit image | `SUGGESTED_EDIT_MODELS` | Fal |
| Media analysis, per media kind | `SUGGESTED_ANALYSIS_MODELS` | OpenRouter |

- **Composer** offers the list for the current use case
  (`suggestedModels(useCase)`), with its first model picked until the person
  picks another. **MediaAnalyzer** offers the analysis lists.
- **Your own list wins.** Pass `models` (or `modelsByKind`) to replace a
  list, or `[]` for no Model menu. Nothing is required.
- **Each suggested model knows its inputs**: its aspect ratios, and for Fal
  the field its image goes in (`falInput`), so the Fal engine sends exactly
  what that model expects.
- **They change only through package releases.** Providers change faster,
  so check them while setting up your engine. It needs no key, runs no
  model and costs nothing:

```ts
import { checkSuggestedModels } from "@chai-ui/react";

const { ok, problems } = await checkSuggestedModels();
// problems: [{ provider: "fal", modelId, problem: "No longer takes these aspect_ratio values: 21:9." }]
```

  It confirms each model still exists and is active, still takes the
  aspect ratios and image field Chai sends (Fal), and still accepts its media
  kind (OpenRouter). If something changed, pick another model or update the
  package once a release catches up.

## `useComposer` — wiring `Composer` to a real engine

```tsx
import { ChaiProvider, useComposer, createFalEngine, Composer, ResultCard } from "@chai-ui/react";

// The reasoning models write text (Enhance, routing, text requests) and
// are separate from the media engine. With no props,
// Claude Opus 5 handles text and images, Gemini 3.8 Flash handles video
// and audio, both on `createOpenRouterEngine()`. Without a provider,
// Composer's Enhance button stays hidden.
function Root() {
  return (
    <ChaiProvider>
      <App />
    </ChaiProvider>
  );
}

function App() {
  const { run, runs, submit, cancel, enhance, enhancing } = useComposer({
    engine: createFalEngine({ outputKind: "image" }),
  });
  // Every model's result from every use case, paged in one card.
  const results = runs.flatMap((r) => r.results);
  const busy = results.some((r) => r.status === "queued" || r.status === "running");

  return (
    <>
      <Composer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        submitting={busy}
        onAbort={cancel}
        onEnhance={enhance ? (v) => enhance(v).then(setValue) : undefined}
        enhancing={enhancing}
        // ...the rest of Composer's own props, as above
      />
      {run && (
        <ResultCard
          results={results}
          prompt={run.request.prompt}
          onAction={(action, result) => {
            // like / dislike / retry / download / share / your "more" actions
          }}
        />
      )}
    </>
  );
}
```

`submit` takes `Composer`'s `ComposerSubmitPayload` directly — pass it
straight to `onSubmit`. It turns each selection into a real
`Request`/`Run`/`Result`: creates a `"queued"` `Result` per model up
front, then folds each one to `"running"` → `"done"`/`"error"` as the
engine settles it. `run` is the first `Run` (or `null` before the first
submit); `runs` holds one per use case when `multiSelectUseCases` is on.
Pass `ResultCard` the results of every run, as above: it pages through
them, and each page shows its own kind (image, video, audio or text).
Passing only `run.results` would hide every use case after the first.

**The server route.** `createFalEngine()` and the OpenRouter reasoning
engine call `/api/chai/*` on your server, which adds the API keys. Add it
with one file, then set `FAL_KEY` and `OPENROUTER_API_KEY`:

```ts
// Next.js: app/api/chai/[...path]/route.ts
import { createChaiHandler } from "@chai-ui/core/server";
export const { GET, POST, PUT } = createChaiHandler();
```

Other frameworks, and the `authorize` / `allowedModels` settings to add
before going live, are in the `@chai-ui/core` README.

Every default is a suggestion. Swap any of them:

```tsx
<ChaiProvider
  reasoningModel="your/text-and-image-model"
  // Cheaper video and audio analysis; kinds you leave out keep their default.
  reasoningModelByKind={{ video: "qwen/qwen3.8-omni-flash", audio: "qwen/qwen3.8-omni-flash" }}
  reasoningEngine={yourEngine}
/>
```

The defaults are exported as `DEFAULT_REASONING_MODEL` and
`DEFAULT_REASONING_MODEL_BY_KIND`.

`useComposer`'s own `reasoningEngine` + `reasoningModel` override the
provider's, but only when both are set. Text requests go to `textEngine`
(default: the reasoning engine, then a mock text engine), using
`textModel` (default: the reasoning model) when no model is picked. Other kinds go to `engineByKind[kind]`, then `engine`. With no
model picked, the engine's own default model runs.

**Stop.** `cancel()` stops the current submit: wire it to Composer's
`onAbort`, with `submitting` true while results are queued or running.
Unfinished results turn `"cancelled"` (ResultCard shows "Stopped"; a
streamed text result keeps what arrived), and a new submit cancels the
previous one. Cancellation is best effort at the provider: Fal removes a
queued request and signals a running one, which may still finish;
OpenRouter stops a *streaming* request, and its billing, only for
providers that support it (not Google); a non-streaming request keeps
running. A custom engine receives `signal` in `generate()`: cancel at the
provider if it can, then reject with an `AbortError` (`abortError()`).

## Editing an image: `EditCard`

The attach menu's "Edit image" puts `Composer` in edit mode. Set the use case
to `EDIT_IMAGE_USE_CASE`, pass the attached image to `useComposer` as
`editImage`, and drop in the card:

```tsx
import { Composer, EditCard, EDIT_IMAGE_USE_CASE, SUGGESTED_EDIT_MODELS, useComposer } from "@chai-ui/react";

const editImage = useCase?.edit ? (attachments.find((a) => a.kind === "image") ?? null) : null;
const { run, submit, edit } = useComposer({ engine: createFalEngine({ outputKind: "image" }), editImage });
// Unpicked, the first suggested edit model (Flux 3 Image) runs.
const model = SUGGESTED_EDIT_MODELS.find((m) => m.id === modelId) ?? SUGGESTED_EDIT_MODELS[0];

{edit && <EditCard {...edit} maxRegions={model?.maxRegions} />}
{!edit && run && <ResultCard results={run.results} prompt={run.request.prompt} onAction={…} />}
<Composer
  // ...your other Composer props
  useCase={useCase}
  onAttachMenuSelect={(action) => {
    if (action === "edit-media") setUseCase(EDIT_IMAGE_USE_CASE);
  }}
  regions={edit?.regions}
  onRegionsChange={edit?.onRegionsChange}
  onSubmit={submit}
/>
```

- **Regions.** "New region" adds a box with an instruction field. The check
  adds it to the prompt (a colored chip in the Composer); trash removes it.
  Drag to move, drag a corner to resize; by keyboard, arrows move and Shift
  + arrows resize. Zoom keeps the image inside the card; drag to pan.
- **Submitting.** An edit needs the image plus a whole-image prompt, a
  region, or both. Regions carry their own instructions, so the prompt can
  stay empty.
- **Models.** In edit mode Composer offers `SUGGESTED_EDIT_MODELS`: Flux 3
  Image first, which reads each region as a box, then Nano Banana Pro and
  GPT Image 2. Offer any edit model you like; one without a `regionFormat`
  gets its regions described in words, which is less precise. Change how
  the prompt is built with `useComposer`'s `editPrompt`.
- **Versions.** Each edit's result is a new version, shown in the card with
  dots to page back. The next edit applies to the version showing.
- **Images only** for now.

