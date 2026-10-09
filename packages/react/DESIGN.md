# CHAI UI — DESIGN.md

The rules for building with `@chai-ui/react` or `@chai-ui/vue`, written for
the people and the coding agents who integrate them. Both packages ship
this file. It uses React's names; "In Vue" below maps them. The API reference is the JSDoc on each
component's props and the docs site's `llms.txt`. This file covers how to
use the pieces correctly: which component to pick, which tokens to use,
which states you get for free, and what not to build.

If this file and the code disagree, the code wins. Please report the
mismatch.

## 1. Pick the component, don't rebuild it

| You need | Use | Not |
|---|---|---|
| A prompt box with attach, model and aspect-ratio pickers, submit | `Composer` | A hand-built textarea + button row |
| Media (image, video, audio) in, a generation-ready prompt out | `MediaAnalyzer` + `useMediaAnalyzer` | A file input plus your own model call |
| One prompt's generated output (image, video, audio, text) | `ResultCard` | A custom media card |
| Editing an image: marked regions, each with its own instruction | `EditCard` + `EDIT_IMAGE_USE_CASE` + `useComposer`'s `editImage` | A canvas or box-drawing library of your own |
| Submit → engine → result state, wired together | `useComposer` | Your own fetch/loading/error state |
| One reasoning model shared by every component | `ChaiProvider`, `useReasoning` | A text model picked per component |
| A switch, an option menu, a pager | `Toggle`, `SearchMenu`, `Pagination` | Another UI kit's versions inside a CHAI surface |

These don't exist yet. Don't import them, and don't invent stand-ins that
use these names: `Results`, `Compare`, `ModelPicker`,
`ParamControls`, `Presets`, `RunSummary`, `MediaViewer`, `createHttpEngine`.

## 2. Integration rules

1. **Load the CSS in order:** `@chai-ui/tokens/css` first, then
   `@chai-ui/react/style.css` (or `@chai-ui/vue/style.css`). Component
   styles read the token variables.
2. **Everything is controlled.** Every value comes in as a prop and every
   change comes out as a callback (`value` / `onChange`). Keep the state in
   your app.
3. **Advanced selection is the builder's opt-in.** `multiSelectModels`
   and `multiSelectUseCases` are off by default. Turn them on only where
   comparing models or making several media types at once is the point.
4. **A callback's presence is the opt-in.** Omit `onEnhance` and there's
   no optimize button. Omit `onAbort` and there's no stop button. Omit
   `moreActions` and there's no ⋯ menu. Don't pass no-op handlers just to
   make a control appear.
5. **API keys never reach the browser.** Engines call one same-origin
   route, `/api/chai/*`, served by `createChaiHandler` from
   `@chai-ui/core/server`, which adds the key. Never pass a key to
   `createFalEngine` or `createOpenRouterEngine`. In production, set the
   handler's `authorize` and `allowedModels`.
6. **Media generation and reasoning are separate choices.** `engine`
   generates media and defaults to Fal.ai. `ChaiProvider`'s
   reasoning models power Enhance, routing and text requests. Defaults:
   Claude Opus 5 for text and images, Gemini 3.8 Flash for video and
   audio, on OpenRouter. They're suggestions; respect a builder's own
   `reasoningModel`, `reasoningModelByKind` and `reasoningEngine`.
7. **Suggest models, never require them.** With no `models`, Composer and
   MediaAnalyzer use the suggested lists (`suggestedModels`,
   `SUGGESTED_ANALYSIS_MODELS`), each model carrying its verified aspect
   ratios and Fal input format. A builder's own list always wins. Don't
   make a builder write a model list to get a working Model menu.
8. **Only show what's real.** Show cost only when the engine reports it.
   Don't show model rankings or leaderboard positions you can't keep up to
   date. Don't show a control the selected model can't honor.

### In Vue

The same components, rules and behavior, with Vue's names:

- `value` / `onChange` is `v-model`; every other `x` / `onXChange` pair is
  `v-model:x` (`v-model:attachments`, `v-model:model-id`, `v-model:regions`, …).
- Other callbacks are events: `@submit`, `@action`, `@enhance`, `@abort`.
  Rule 4 holds: a control that needs a callback shows only with its
  listener (`@enhance` for the optimize button, `@abort` for stop,
  `@update:model-id` for the Model menu).
- `useComposer` and `useMediaAnalyzer` are composables returning refs.
  Pass a getter for options that change: `useComposer(() => ({ engine, editImage: image.value }))`.
- `ChaiProvider` is a component with the same props.

## 3. Material components, and where Chai uses its own

Chai builds on Material Design 3's web components where they fit, and
uses its own component where they don't. Both kinds take every color from
Chai tokens (§4), so they look like one system.

| Native Material component | Where Chai uses it |
|---|---|
| `<md-fab>` | The submit, retry and stop button |
| `<md-switch>` (`Toggle`) | Auto-select model, and any switch you add |
| `<md-checkbox>` | The checkboxes on rows in a multi-select model menu |
| `<md-outlined-text-field>` | The search field in searchable menus |
| `<md-focus-ring>` | The focus ring on all of the above |

Chai's own components are the menus (`SearchMenu` and the attach menu),
the use-case chips, `Pagination`, and the cards. The menus are the main
difference, because Material has an `<md-menu>`:

- **Placement.** `<md-menu>` opens as a floating popover anchored to a
  corner of its trigger. Chai's menus open as a panel directly under their
  trigger, inside the component, as the Figma designs show.
- **Features `<md-menu>` doesn't have.** Chai's model menus need a search
  field, grouped sections with headings (one per use case), a switch
  pinned at the top (auto-select), and multi-select. `<md-menu>` closes
  when an item is picked and has none of these.
- **Portability.** Chai isn't tied to Material. Its own components restyle
  entirely through tokens, which keeps the door open to other design
  systems later.

They still follow Material's conventions where they apply: a trailing
check mark for single-select, MD3's own checkbox for multi-select,
and Material's type scale. Each option is a plain button: reach it with
Tab, pick it with Enter or Space; `aria-pressed` marks what's picked.

## 4. Tokens

All visual values come from `@chai-ui/tokens`, which builds from one JSON
source into CSS variables, JS/TS and a Figma token set. **It is the only
source of color:** no component contains a hard-coded color, and Material's
colors are driven by Chai tokens, not the other way around.

| Layer | Pattern | Use it for |
|---|---|---|
| Root palette | `--chai-color-root-{gray, green, amber, red}-*` | Nothing directly. It only feeds the layers below. `green-50` (`#009747`) is the brand green. |
| Brand and state | `--chai-color-semantic-{accent, accent-hover, accent-subtle, accent-soft, accent-text, text-on-accent, warning, warning-subtle, danger, danger-subtle}` | The brand green and state colors. Use `accent` for fills, icons and focus rings, and `accent-text` for green text (`accent` is only 3.8:1 on white). |
| Controls | `--chai-color-semantic-control-{surface, surface-hover, surface-raised, track, divider, border, border-soft, border-faint, text-strong, text, text-muted}` | The pure grays the components are built from. |
| Overlays and media | `--chai-color-semantic-{overlay, on-overlay, scrim, media-backdrop}` | Buttons and backdrops on top of images and video |
| Space | `--chai-space-0` … `--chai-space-8` (0, 4, 8, 12, 16, 24, 32, 48, 64px) | Padding, gaps, margins |
| Radius | `--chai-radius-{sm, md, lg, full}` | Corners |
| Type | `--chai-type-{family, size, weight, leading, tracking}-*` | Text |
| Motion | `--chai-motion-duration-{fast, base, slow, steep}`, `--chai-motion-easing-{standard, growth}` | Transitions |
| Effects | `--chai-shadow-menu`, `--chai-gradient-ai` | Floating menus, and the AI shimmer after prompt optimization |
| Component | `--chai-composer-{bg, border, hover, placeholder, text}`, `--chai-media-analyzer-{bg, border, hover, text}` | Restyling that one component. Each defaults to a control role. |
| Material | `--md-sys-color-*` | Nothing in your code. They exist so the Material switch, button and text field follow Chai tokens. |

Rules:

- **Never invent a token name.** If it isn't listed above or in
  `@chai-ui/tokens/css`, it doesn't exist, and `var()` on an unknown name
  silently falls back to nothing.
- **Never put a literal color on a component.** Use a semantic role. If a
  design needs a color that has no role yet, add the role to
  `packages/tokens/src/tokens.json` instead of writing the hex.
- **Restyle by overriding variables, not selectors.** Override the
  semantic roles on `:root` to restyle everything, including the Material
  components, or set a component variable like `--chai-composer-bg` on
  `.chai-composer` to restyle one component. Don't target internal
  `.chai-*__*` class names. Those are implementation details and can
  change without notice.

## 5. AI states you get for free — use them, don't replace them

| Situation | Built-in behavior | Your part |
|---|---|---|
| Generation failed | `Composer`'s submit button becomes a retry action and an inline message appears (`submitError`) | Set `submitError`, and clear it on success or when the prompt changes. **No error dialogs or toasts for a failed generation.** |
| Request in flight | Submit becomes a stop button (`submitting` + `onAbort`) | Pass `useComposer`'s `cancel` as `onAbort`; results show "Stopped" |
| Prompt too thin | Optimize button rewrites the prompt, then offers undo (`onEnhance`) | Run the rewrite and call `onChange` with the new text |
| No use case picked | The prompt is a text request and gets a text reply | Set `defaultUseCase` if your app's default should be image or video |
| Result pending | `ResultCard` shows a spinner for `queued` / `running` | Nothing. `useComposer` sets the status. |
| Long text answer | `ResultCard` keeps line breaks, scrolls past 400px with a visible scrollbar, and follows streaming text unless the person scrolls up | Change the height with `textMaxHeight` if needed |
| Text streaming in | `ResultCard` renders partial text with a caret, marked `aria-busy` | Use an engine that calls `onText` (OpenRouter does, and so does the mock text engine). `useComposer` wires it. |
| Result failed | `ResultCard` shows the error message in place | Nothing |
| Image edit in progress | `EditCard` shows a spinner over the image being edited, then the edit as a new version | Nothing. `useComposer` adds the version. |
| Edit model's region limit | `EditCard` disables "New region" at `maxRegions` | Pass the chosen model's `maxRegions` |
| Try again | `ResultCard`'s retry fires `onAction("retry", result)` | Re-run the **same** model call, not a different one |
| Feedback | Like/dislike fire `onAction`, and the displayed vote comes from `getVote` | Store votes yourself |
| Details | The flip side shows prompt, model, tokens, cost and duration | Supply `models` so ids resolve to labels |
| Quality checks | Each result's `evaluations` render on the flip side: green with a check if it passed, red with a cross if it failed | Run your checks in your backend proxy and add a top-level `evaluations: [{ id, label, passed }]` field to the JSON it returns (for a stream, send it as its own `data:` chunk). The built-in Fal and OpenRouter engines read that field, a custom engine returns it from `generate`, and `useComposer` puts it on the matching `Result`. CHAI never runs or scores anything itself, and there are no confidence scores. |

`ResultCard` is where a run ends. Don't add a "use as input" action that
feeds a result back into a `Composer`. Chaining steps like that is
deliberately out of scope. The one exception is `EditCard`: an edit's result
is a new version of the same image, and the next edit applies to the version
showing.

## 6. Accessibility

- Every icon-only button in CHAI has an accessible name. In `moreActions`,
  `label` is the item's visible and announced text, so pass an `icon` that
  is `aria-hidden`.
- Animations (the optimize reveal, the streaming caret) are disabled under
  `prefers-reduced-motion`. Your own motion around CHAI should do the same.
- **Focus rings are on by default, as WCAG 2.2 AA requires** (2.4.7 Focus
  Visible). Every control shows a ring when it
  has keyboard focus: buttons and menu items use the browser's own ring,
  MD3 elements use `<md-focus-ring>`, and the Composer rings its whole pill
  while the prompt field is focused. Hover fills don't replace these,
  because hover never appears for someone navigating with a keyboard.
- **To hide them**, set `data-chai-focus-ring="hidden"` on any ancestor.
  Every CHAI component inside it stops drawing focus rings, and your own
  controls under the same ancestor are unaffected. Remove the attribute to
  turn them back on:

  ```tsx
  <div data-chai-focus-ring={showFocusRings ? undefined : "hidden"}>…</div>
  // or page-wide:
  document.documentElement.dataset.chaiFocusRing = "hidden";
  ```

  **Hiding focus rings breaks WCAG 2.2 AA (and 2.1 AA) compliance.** Keyboard users
  lose any indication of where they are. Only hide them on showcase or
  preview surfaces, like the docs site's component previews, not in a
  production app. Don't set `tabIndex={-1}` on CHAI controls either.
- Streaming text is `aria-busy` until it settles, so screen readers read
  the finished text once instead of every chunk.
- **Supports WCAG 2.2 AA.** Chai's components are built to support WCAG 2.2 AA and are tested
  against it with automated checks: axe (WCAG 2.0, 2.1 and 2.2, levels A
  and AA) on every component state in the test suite, plus keyboard and
  focus tests in a browser. They haven't been tested by hand with a
  screen reader, so this is support, not a certification. Compliance is
  judged for a whole app, so test yours, including with a screen reader.

  What that covers: contrast, focus rings, a name for every control
  (`Composer`'s `promptLabel`, `Toggle`'s `ariaLabel`), alt text for
  generated images (`ResultCard`'s `altText`, default the prompt), 24px
  targets, and keyboard use: video play/pause (Tab to the video, Space)
  and seeking (a slider: arrow keys, Home, End), paging (`Pagination` is
  one slider rather than a button per dot, so the dots can sit 16px apart:
  arrow keys, Home, End), the turned-away side of a
  flipped card is `inert` and focus follows the flip, and the expanded
  view is a dialog (focus inside, Escape closes, focus returns to Expand).

## 7. What's enforced

Inside this repo, `pnpm lint` runs `scripts/lint-tokens.mjs` over the
packages' CSS:

- It fails on `var(--…)` names that don't exist (invented tokens).
- It fails on any hard-coded color, custom properties included.
- It fails on direct use of Material's `--md-sys-color-*` roles, which
  must go through the Chai token they map to.

TypeScript enforces the component APIs: controlled props, typed submit
payloads, and typed engine and result shapes. `ResultCard`'s `onAction`
is a plain `string` so it can carry your own `moreActions` ids, which
means a misspelled action name isn't caught. Nothing checks your
app's own CSS or markup yet, so sections 1–6 above are guidance there, not
guarantees.
