import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ModelOption, Result } from "@chai-ui/core";
import { Pagination } from "./primitives/Pagination.js";

/**
 * ResultCard's complement to Composer bar, and the last stop in the
 * pipeline: by design there's no "use as input" action feeding a result
 * back into a Composer.
 *
 * Renders the results from one prompt (reference: Figma "08 Result from
 * Composer Bar") — a single result, or paginated through several (the
 * "Image - Paginated" state) when more than one is handed in. That's a
 * different thing from the still-unscoped plural `Results` grid/stack/
 * carousel container — this card
 * only ever shows what came back from one prompt, one candidate at a time,
 * never a grid of separate prompts/history.
 */

// --- Formatting ------------------------------------------------------------

function formatDuration(ms: number | undefined): string | undefined {
  if (ms == null) return undefined;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number | undefined): string | undefined {
  if (usd == null) return undefined;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(total: number | undefined): string | undefined {
  if (total == null) return undefined;
  return `${total.toLocaleString()} tokens`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A real, exactly-reduced ratio (e.g. 1024×768 → "4:3", 1920×1080 → "16:9") from the media's own measured dimensions — not a guess at the nearest "named" ratio, so an unusual crop just shows its own honest (if less familiar) reduced fraction instead of a misleading rounded one. */
function formatAspectRatio(width: number, height: number): string | undefined {
  if (!width || !height) return undefined;
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = gcd(w, h);
  if (!divisor) return undefined;
  return `${w / divisor}:${h / divisor}`;
}

/** A real extension from the URL itself when there is one, otherwise a sensible guess by kind — used only for the downloaded file's suggested name, not anything that affects the actual bytes. */
function guessDownloadFilename(result: Result): string {
  const kind = result.output?.kind ?? "file";
  const src = result.output?.src ?? "";
  const match = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(src);
  const ext = match?.[1] ?? (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : kind === "text" ? "txt" : "png");
  return `${kind}-${result.id}.${ext}`;
}

// --- Public types ------------------------------------------------------------

/** One row in the "more" (⋯) menu, for app-specific actions (e.g. "Flag content"). ResultCard can't implement any of them — every one of these just fires `onAction` with this `id`. */
export interface ResultCardMoreAction {
  id: string;
  label: string;
  icon?: ReactNode;
}

export type ResultCardVote = "like" | "dislike" | null;

export interface ResultCardProps {
  /** The results from one prompt — `results[0]` if there's only one, paginated internally if more. */
  results: Result[];
  /**
   * Fixed width in px — defaults to 375 (the Figma mock's own width), not
   * to the displayed media's actual pixel dimensions. The card's own
   * footprint has to stay predictable for whatever app it's embedded in;
   * a real generated image could be anywhere from a few hundred to a few
   * thousand pixels wide, and this card was never meant to render at that
   * native size — that's what the "Expand" button is for. Height still
   * follows the media's own aspect ratio at this width (see
   * `.chai-result-card`'s own CSS comment) — only the width is fixed.
   */
  width?: number;
  /** Max height in px of a text result before it scrolls — defaults to 400. Text results are often long; the card stays a predictable size and the text scrolls inside it. */
  textMaxHeight?: number;
  /** The request's source prompt — shown read-only (copiable, not editable) on the flipped info side. */
  prompt: string;
  /** Alt text for a generated image. Defaults to `prompt`, which describes what was asked for. */
  altText?: (result: Result) => string;
  /** Resolves `Result.modelId` to a human-readable label (reference: "GPT-4o Image Pro", not a raw id) — falls back to the raw id when not found. */
  models?: ModelOption[];
  /**
   * Resolves a result's vote, if any — controlled, not tracked by
   * ResultCard itself: what a vote means is the app's policy. A function, not a single flat value: pagination
   * is internal to this component (not a prop the host controls — see
   * `results`'s own doc comment), so a host can't know in advance which
   * result is currently paginated-to in order to hand back the right one.
   */
  getVote?: (result: Result) => ResultCardVote;
  /**
   * Fires for every action this card can trigger: `"like"` / `"dislike"`
   * (always fires the plain vote name, even to toggle one back off — the
   * app decides what re-clicking an already-active vote means, same as it
   * decides what the vote itself means), `"download"`, `"share"`,
   * `"copy-prompt"`, `"retry"` (expected to re-run the exact same model
   * call), or one of
   * `moreActions`' own ids.
   */
  onAction: (action: string, result: Result) => void;
  /** Configurable extra items in the "more" menu (reference: Figma "Result Card - More menu expanded") — entirely up to the host. Omit to hide the "more" button entirely. */
  moreActions?: ResultCardMoreAction[];
  disabled?: boolean;
}

// --- Component ------------------------------------------------------------

export function ResultCard({
  results,
  width,
  textMaxHeight,
  prompt,
  altText,
  models,
  getVote,
  onAction,
  moreActions,
  disabled,
}: ResultCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  // Not part of `Result` (no engine reports generated-media dimensions
  // today) — measured client-side off the loaded `<img>`/`<video>` itself
  // (`naturalWidth`/`naturalHeight`, `videoWidth`/`videoHeight`) purely to
  // back the info side's aspect-ratio chip. Kept with the id of the result
  // it was measured from, so after pagination a stale ratio from the
  // *previous* result can't flash before the new media finishes loading.
  const [measured, setMeasured] = useState<{ id: string; width: number; height: number } | null>(null);
  const videoTimeRef = useRef(0);
  // The face that's turned away is `inert`, so its buttons can't be tabbed
  // to. Set as a DOM property: React 18 and 19 treat the `inert` attribute
  // differently.
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (frontRef.current) frontRef.current.inert = flipped;
    if (backRef.current) backRef.current.inert = !flipped;
  });

  // Flipping moves focus to the side now showing, so a keyboard user isn't
  // left on a button that just turned away. Skipped on first render.
  const wasFlipped = useRef(flipped);
  useEffect(() => {
    if (wasFlipped.current === flipped) return;
    wasFlipped.current = flipped;
    const target = flipped
      ? backRef.current?.querySelector<HTMLElement>('[aria-label="Close details"]')
      : frontRef.current?.querySelector<HTMLElement>('[aria-label="Show details"]');
    target?.focus();
  }, [flipped]);

  // The expanded view is a modal dialog: focus moves in, Tab stays inside,
  // Escape closes, and focus returns to what opened it.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mediaExpanded) return;
    overlayRef.current?.querySelector<HTMLElement>(".chai-result-card__collapse")?.focus();
    // On close, back to Expand, the only way in. Looked up at close time:
    // the card re-renders its media buttons while expanded.
    const front = frontRef.current;
    return () => front?.querySelector<HTMLElement>('[aria-label="Expand"]')?.focus();
  }, [mediaExpanded]);

  function handleOverlayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setMediaExpanded(false);
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [
      ...e.currentTarget.querySelectorAll<HTMLElement>('button, [tabindex="0"], a[href], input, video[controls]'),
    ].filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  // State, not a ref: the player reads it while rendering, and it only
  // changes on play/pause.
  const [videoWasPlaying, setVideoWasPlaying] = useState(false);
  const clampedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
  const result = results[clampedIndex];

  const mediaDims = measured && measured.id === result?.id ? measured : null;

  if (!result) return null;

  const vote = getVote?.(result) ?? null;
  const modelLabel = models?.find((m) => m.id === result.modelId)?.label ?? result.modelId;
  const duration = formatDuration(result.durationMs);
  const cost = formatCost(result.usage?.costUsd);
  const tokens = formatTokens(result.usage?.totalTokens);
  const aspectRatio = mediaDims ? formatAspectRatio(mediaDims.width, mediaDims.height) : undefined;

  // Arrow expressions, not function declarations — a hoisted declaration
  // doesn't inherit the `if (!result) return null;` narrowing above (a
  // known TS limitation, not stylistic), so every one of these closing
  // over `result` needs to be an expression instead.
  const goTo = (index: number) => {
    setActiveIndex(Math.max(0, Math.min(results.length - 1, index)));
  };

  const handleCopyPrompt = () => {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onAction("copy-prompt", result);
  };

  const handleDownload = async () => {
    if (result.output) {
      // A plain `<a download href={remoteUrl}>` only forces a real download
      // for a same-origin or `blob:`/`data:` URL — for anything else
      // (a normal cross-origin CDN url, which is what a real generated
      // result's `src` almost always is) browsers ignore `download` and
      // just navigate/open it instead, which is exactly the "pops a tab"
      // behavior this replaces. Fetching it into a blob first sidesteps
      // that: a blob: URL is always same-origin, so `download` works
      // reliably regardless of where the media actually lives.
      try {
        const response = await fetch(result.output.src);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = guessDownloadFilename(result);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } catch {
        // The one case this can't force: the source not allowing
        // cross-origin fetches (no CORS headers) or a real network
        // failure. Opening it directly is the best fallback available —
        // still better than silently doing nothing.
        window.open(result.output.src, "_blank", "noopener");
      }
    }
    onAction("download", result);
  };

  const handleShare = async () => {
    if (result.output && navigator.share) {
      try {
        await navigator.share({ url: result.output.src });
      } catch {
        // Cancelled or unsupported for this src — fall through silently, same as a native share sheet dismissal.
      }
    } else if (result.output) {
      navigator.clipboard?.writeText(result.output.src).catch(() => {});
    }
    onAction("share", result);
  };

  const isVideo = result.output?.kind === "video";

  return (
    <>
      <div
        className={`chai-result-card${flipped ? " chai-result-card--flipped" : ""}`}
        style={
          {
            ...(width != null && { "--chai-result-card-width": `${width}px` }),
            ...(textMaxHeight != null && { "--chai-result-card-text-max-height": `${textMaxHeight}px` }),
          } as CSSProperties
        }
      >
        <div className="chai-result-card__inner">
          <div ref={frontRef} className="chai-result-card__face chai-result-card__front" aria-hidden={flipped}>
            <ResultMedia
              result={result}
              alt={altText?.(result) ?? prompt}
              disabled={disabled}
              mediaExpanded={mediaExpanded}
              onDownload={handleDownload}
              onShare={handleShare}
              onExpand={() => setMediaExpanded(true)}
              onDimensions={(w, h) => setMeasured({ id: result.id, width: w, height: h })}
              videoTimeRef={videoTimeRef}
              videoWasPlaying={videoWasPlaying}
              onVideoPlayingChange={setVideoWasPlaying}
            />

            <div className="chai-result-card__bar">
              <div className="chai-result-card__bar-row">
                <div className="chai-result-card__bar-start">
                  <ResultIconButton
                    label="Like"
                    active={vote === "like"}
                    disabled={disabled}
                    onClick={() => onAction("like", result)}
                  >
                    <ThumbUpIcon />
                  </ResultIconButton>
                  <ResultIconButton
                    label="Dislike"
                    active={vote === "dislike"}
                    disabled={disabled}
                    onClick={() => onAction("dislike", result)}
                  >
                    <ThumbDownIcon />
                  </ResultIconButton>
                  <ResultIconButton
                    label="Retry"
                    disabled={disabled}
                    onClick={() => onAction("retry", result)}
                  >
                    <RefreshIcon />
                  </ResultIconButton>
                  {moreActions && moreActions.length > 0 && (
                    <MoreMenu
                      actions={moreActions}
                      open={moreOpen}
                      onOpenChange={setMoreOpen}
                      disabled={disabled}
                      onSelect={(action) => onAction(action.id, result)}
                    />
                  )}
                </div>

                <ResultIconButton
                  label="Show details"
                  disabled={disabled}
                  onClick={() => setFlipped(true)}
                >
                  <InfoIcon />
                </ResultIconButton>
              </div>

              {results.length > 1 && (
                <Pagination
                  count={results.length}
                  index={clampedIndex}
                  onChange={goTo}
                  label="Results"
                  disabled={disabled}
                />
              )}
            </div>
          </div>

        <div ref={backRef} className="chai-result-card__face chai-result-card__back" aria-hidden={!flipped}>
          <button
            type="button"
            className="chai-result-card__close"
            aria-label="Close details"
            onClick={() => setFlipped(false)}
          >
            <CloseIcon />
          </button>

          <div className="chai-result-card__prompt-box">
            <p className="chai-result-card__prompt-text">{prompt}</p>
            <button
              type="button"
              className="chai-result-card__copy"
              aria-label={copied ? "Copied" : "Copy prompt"}
              title={copied ? "Copied" : "Copy prompt"}
              onClick={handleCopyPrompt}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>

          <div className="chai-result-card__chips">
            <span className="chai-result-card__chip">{modelLabel}</span>
            {tokens && <span className="chai-result-card__chip">{tokens}</span>}
            {cost && <span className="chai-result-card__chip">{cost}</span>}
            {duration && <span className="chai-result-card__chip">{duration}</span>}
            {aspectRatio && <span className="chai-result-card__chip">{aspectRatio}</span>}
            {/* The builder's own backend checks (reference: the mock's green
                "Evaluation" chip) — pass green with a check, fail red with a
                cross, so the verdict never relies on color alone. */}
            {result.evaluations?.map((evaluation) => (
              <span
                key={evaluation.id}
                className={`chai-result-card__chip chai-result-card__chip--evaluation chai-result-card__chip--${
                  evaluation.passed ? "passed" : "failed"
                }`}
                title={`${evaluation.label}: ${evaluation.passed ? "passed" : "failed"}`}
              >
                {evaluation.passed ? <CheckIcon /> : <CloseIcon />}
                {evaluation.label}
                <span className="chai-visually-hidden">{evaluation.passed ? ", passed" : ", failed"}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/*
       * The expanded-media overlay (image or video — by design, keep the same explicit "expand" affordance for
       * images too, rather than only video, since an image's own surface
       * isn't a reliable/universal "click to enlarge" gesture on its own)
       * is a sibling of `.chai-result-card` itself, not a descendant —
       * `.chai-result-card` sets `perspective` for the flip animation, and
       * *any* element with `perspective` (like `transform`) becomes a new
       * containing block for its `position: fixed` descendants. An overlay
       * nested inside it would be "fixed" relative to the card's own box,
       * not the viewport — confirmed via a real screenshot during this
       * build (it covered only the card's own area, sidebar and page
       * content still visible around it). Escaping the subtree entirely is
       * what actually fixes it, not a z-index or position tweak.
       *
       * This does mean the expanded `<video>` is a different DOM element
       * from the inline one (remounts, doesn't just get repositioned) —
       * `videoTimeRef`/`videoWasPlaying` are what carry current time and
       * play state across that swap so it doesn't visibly reset. An image
       * has no such state to carry, so it's just rendered twice (inline +
       * overlay) with no special handling — cheap, no decode/playback cost
       * the way a second `<video>` would have.
       */}
      {mediaExpanded && result.output && (result.output.kind === "image" || isVideo) && (
        <div
          ref={overlayRef}
          className="chai-result-card__expand-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={isVideo ? "Expanded video" : "Expanded image"}
          onKeyDown={handleOverlayKeyDown}
        >
          <div
            className="chai-result-card__expand-scrim"
            role="presentation"
            onClick={() => setMediaExpanded(false)}
          />
          <div className="chai-result-card__expand-frame">
            {isVideo ? (
              <ResultVideoPlayer
                src={result.output.src}
                expanded
                timeRef={videoTimeRef}
                wasPlaying={videoWasPlaying}
                onPlayingChange={setVideoWasPlaying}
              />
            ) : (
              <img className="chai-result-card__image" src={result.output.src} alt={altText?.(result) ?? prompt} />
            )}
            <button
              type="button"
              className="chai-result-card__collapse"
              aria-label="Collapse"
              onClick={() => setMediaExpanded(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// --- Media (image / video / audio / text, by status) ------------------------------------------------------------

function ResultMedia({
  result,
  alt,
  disabled,
  mediaExpanded,
  onDownload,
  onShare,
  onExpand,
  onDimensions,
  videoTimeRef,
  videoWasPlaying,
  onVideoPlayingChange,
}: {
  result: Result;
  alt: string;
  disabled?: boolean;
  mediaExpanded: boolean;
  onDownload: () => void;
  onShare: () => void;
  onExpand: () => void;
  onDimensions: (width: number, height: number) => void;
  videoTimeRef: React.MutableRefObject<number>;
  videoWasPlaying: boolean;
  onVideoPlayingChange: (playing: boolean) => void;
}) {
  const isVideo = result.output?.kind === "video";
  const isImage = result.output?.kind === "image";
  // "Running with output" is a text result streaming in (see `streamResult`
  // in @chai-ui/core) — show the partial text, not the spinner.
  const streaming = result.status === "running" && result.output?.kind === "text";

  if ((result.status === "queued" || result.status === "running") && !streaming) {
    return (
      <div className="chai-result-card__media chai-result-card__media--pending">
        <span className="chai-result-card__spinner" aria-label={result.status === "running" ? "Running" : "Queued"} />
      </div>
    );
  }

  // Stopped before any output: say so. A streamed text result that was
  // stopped keeps its partial text and renders below like any other.
  if (result.status === "cancelled" && !result.output) {
    return (
      <div className="chai-result-card__media chai-result-card__media--cancelled">
        <p className="chai-result-card__cancelled-text">Stopped</p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="chai-result-card__media chai-result-card__media--error">
        <p className="chai-result-card__error-text">{result.error?.message ?? "Something went wrong."}</p>
      </div>
    );
  }

  if (!result.output) return <div className="chai-result-card__media" />;

  return (
    <div
      className={`chai-result-card__media${
        result.output.kind === "audio" || result.output.kind === "text"
          ? " chai-result-card__media--fixed-height"
          : ""
      }`}
    >
      {result.output.kind === "video" ? (
        mediaExpanded ? (
          // The real, playing `<video>` lives in the expand overlay (a
          // sibling of the whole card — see that overlay's own comment for
          // why) while it's open; this card face just shows a plain
          // frozen frame in its place so the layout doesn't collapse.
          <img className="chai-result-card__image" src={result.output.src} alt="" />
        ) : (
          <ResultVideoPlayer
            src={result.output.src}
            timeRef={videoTimeRef}
            wasPlaying={videoWasPlaying}
            onPlayingChange={onVideoPlayingChange}
            onDimensions={onDimensions}
          />
        )
      ) : result.output.kind === "audio" ? (
        <audio className="chai-result-card__audio" src={result.output.src} controls />
      ) : result.output.kind === "text" ? (
        <ResultText text={result.output.src} streaming={streaming} />
      ) : (
        <img
          className="chai-result-card__image"
          src={result.output.src}
          alt={alt}
          onLoad={(e) => {
            const el = e.currentTarget;
            onDimensions(el.naturalWidth, el.naturalHeight);
          }}
        />
      )}

      {!mediaExpanded && !streaming && (
      <div className="chai-result-card__media-actions">
        <ResultIconButton label="Download" disabled={disabled} onClick={onDownload}>
          <DownloadIcon />
        </ResultIconButton>
        <ResultIconButton label="Share" disabled={disabled} onClick={onShare}>
          <ShareIcon />
        </ResultIconButton>
        {(isVideo || isImage) && (
          <ResultIconButton label="Expand" disabled={disabled} onClick={onExpand}>
            <ExpandIcon />
          </ResultIconButton>
        )}
      </div>
      )}
    </div>
  );
}

/**
 * A text result, streaming or finished. One element for both states, so the
 * scroll position survives the moment a stream completes. Past its max
 * height it scrolls; while streaming it follows the newest text, unless the
 * person has scrolled up to read, in which case it stays where they are.
 */
function ResultText({ text, streaming }: { text: string; streaming: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const followRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && streaming && followRef.current) el.scrollTop = el.scrollHeight;
  }, [text, streaming]);

  return (
    <p
      ref={ref}
      className={`chai-result-card__text-output${streaming ? " chai-result-card__text-output--streaming" : ""}`}
      // Screen readers wait for the finished text instead of announcing every chunk.
      aria-busy={streaming}
      // Keyboard users can scroll a long answer.
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        followRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
      }}
    >
      {text}
    </p>
  );
}

/**
 * A real `<video>` element plus custom play/pause + scrubber chrome built
 * on its own playback API (`currentTime`, `duration`, the `timeupdate`
 * event) — not the browser's native `controls` UI (reads as a different,
 * heavier chrome than the mock's slim in-card scrubber) and not a
 * from-scratch player (nothing here decodes or renders video itself, the
 * real `<video>` element still does all of that).
 *
 * Used in two different mount points (inline in the card, and again in the
 * expand overlay — see that overlay's own comment on why it can't just be
 * the same element repositioned) — `timeRef`/`wasPlaying` are what let
 * whichever one mounts pick up exactly where the other left off: seeded on
 * mount, kept live on every timeupdate/play/pause so the *other* instance
 * has an up-to-date value whenever it mounts next.
 */
function ResultVideoPlayer({
  src,
  expanded,
  timeRef,
  wasPlaying,
  onPlayingChange,
  onDimensions,
}: {
  src: string;
  expanded?: boolean;
  timeRef: React.MutableRefObject<number>;
  wasPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  onDimensions?: (width: number, height: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(wasPlaying);
  const [progress, setProgress] = useState(0);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  }

  function handleScrub(e: React.MouseEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
  }

  // Keyboard seeking, the slider pattern: arrows move 5s, Home/End jump.
  function handleScrubKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step != null) el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + step));
    else if (e.key === "Home") el.currentTime = 0;
    else if (e.key === "End") el.currentTime = el.duration;
    else return;
    e.preventDefault();
  }

  return (
    <>
      <video
        ref={videoRef}
        className="chai-result-card__video"
        src={src}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          el.currentTime = timeRef.current;
          if (wasPlaying) el.play().catch(() => {});
          onDimensions?.(el.videoWidth, el.videoHeight);
        }}
        onPlay={() => {
          setPlaying(true);
          onPlayingChange(true);
        }}
        onPause={() => {
          setPlaying(false);
          onPlayingChange(false);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          timeRef.current = el.currentTime;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
      />
      {/* One control over the whole video: click, or Tab then Space/Enter, to
          play or pause. The round Play badge is just its paused look. */}
      <button
        type="button"
        className="chai-result-card__video-toggle"
        aria-label={playing ? "Pause" : "Play"}
        onClick={togglePlay}
      >
        {!playing && (
          <span className="chai-result-card__play">
            <PlayIcon />
          </span>
        )}
      </button>
      <div
        className={`chai-result-card__scrubber${expanded ? " chai-result-card__scrubber--expanded" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${Math.round(progress * 100)}%`}
        onClick={handleScrub}
        onKeyDown={handleScrubKey}
      >
        <div className="chai-result-card__scrubber-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </>
  );
}

// --- Shared icon button (the hover circle — reference: the design note that the "like" button's hover treatment in the mock applies to every small icon button on the card) ------------------------------------------------------------

function ResultIconButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chai-result-card__icon-btn${active ? " chai-result-card__icon-btn--active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// --- More menu (reference: Figma "Result Card - More menu expanded") — same hand-rolled positioned-popover pattern Composer.tsx's own ComposerAttachMenu documents, for the same reason (needs to live inline under its own trigger). ------------------------------------------------------------

function MoreMenu({
  actions,
  open,
  onOpenChange,
  disabled,
  onSelect,
}: {
  actions: ResultCardMoreAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onSelect: (action: ResultCardMoreAction) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="chai-result-card__more" ref={rootRef}>
      <ResultIconButton label="More" active={open} disabled={disabled} onClick={() => onOpenChange(!open)}>
        <MoreHorizIcon />
      </ResultIconButton>
      {open && (
        <ul className="chai-result-card__more-menu" role="menu">
          {actions.map((action) => (
            <li key={action.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="chai-result-card__more-menu-item"
                onClick={() => {
                  onOpenChange(false);
                  onSelect(action);
                }}
              >
                {action.icon && <span className="chai-result-card__more-menu-icon">{action.icon}</span>}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Icons ------------------------------------------------------------
// Traced from the design's exported assets ("Result from Composer Bar") — same "trace and inline as a
// currentColor component" convention Composer.tsx documents, icons aren't
// shared across files yet in this codebase. `PlayIcon`/`PauseIcon`/
// `ExpandIcon` aren't in the mock itself (its video state has no separate
// play-button layer — the triangle in the reference screenshot is baked
// into that frame's placeholder photo, not a real asset) — real Material
// Symbols glyphs / a simple hand-drawn corner-bracket mark instead.

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M5.25039 15.7502V6.00019L10.5004 0.750193L11.8879 2.13769L10.9129 6.00019H17.2504V9.30019L14.5129 15.7502H5.25039ZM6.75039 14.2502H13.5004L15.7504 9.00019V7.50019H9.00039L10.0129 3.37519L6.75039 6.63769V14.2502ZM1.50039 15.7502V6.00019H5.25039V7.50019H3.00039V14.2502H5.25039V15.7502H1.50039Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.24961 12C1.84961 12 1.49961 11.85 1.19961 11.55C0.899615 11.25 0.749615 10.9 0.749615 10.5V9C0.749615 8.9125 0.762115 8.81875 0.787115 8.71875C0.812115 8.61875 0.837115 8.525 0.862115 8.4375L3.11211 3.15C3.22461 2.9 3.41211 2.6875 3.67461 2.5125C3.93711 2.3375 4.21211 2.25 4.49961 2.25H12.7496V12L8.24961 16.4625C8.06211 16.65 7.84024 16.7594 7.58399 16.7906C7.32774 16.8219 7.08086 16.775 6.84336 16.65C6.60586 16.525 6.43086 16.35 6.31836 16.125C6.20586 15.9 6.18086 15.6688 6.24336 15.4313L7.08711 12H2.24961ZM11.2496 11.3625V3.75H4.49961L2.24961 9V10.5H8.99961L7.98711 14.625L11.2496 11.3625ZM14.9996 2.25C15.4121 2.25 15.7652 2.39688 16.059 2.69063C16.3527 2.98438 16.4996 3.3375 16.4996 3.75V10.5C16.4996 10.9125 16.3527 11.2656 16.059 11.5594C15.7652 11.8531 15.4121 12 14.9996 12H12.7496V10.5H14.9996V3.75H12.7496V2.25H14.9996Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M8.99961 15.0002C7.32461 15.0002 5.90586 14.4189 4.74336 13.2564C3.58086 12.0939 2.99961 10.6752 2.99961 9.00019C2.99961 7.32519 3.58086 5.90644 4.74336 4.74394C5.90586 3.58144 7.32461 3.00019 8.99961 3.00019C9.86211 3.00019 10.6871 3.17832 11.4746 3.53457C12.2621 3.89082 12.9371 4.40019 13.4996 5.06269V3.00019H14.9996V8.25019H9.74961V6.75019H12.8996C12.4996 6.05019 11.9527 5.50019 11.259 5.10019C10.5652 4.70019 9.81211 4.50019 8.99961 4.50019C7.74961 4.50019 6.68711 4.93769 5.81211 5.81269C4.93711 6.68769 4.49961 7.75019 4.49961 9.00019C4.49961 10.2502 4.93711 11.3127 5.81211 12.1877C6.68711 13.0627 7.74961 13.5002 8.99961 13.5002C9.96211 13.5002 10.8309 13.2252 11.6059 12.6752C12.3809 12.1252 12.9246 11.4002 13.2371 10.5002H14.8121C14.4621 11.8252 13.7496 12.9064 12.6746 13.7439C11.5996 14.5814 10.3746 15.0002 8.99961 15.0002Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoreHorizIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.41473 14C5.86473 14 5.3939 13.8042 5.00223 13.4125C4.61056 13.0208 4.41473 12.55 4.41473 12C4.41473 11.45 4.61056 10.9792 5.00223 10.5875C5.3939 10.1958 5.86473 10 6.41473 10C6.96473 10 7.43556 10.1958 7.82723 10.5875C8.2189 10.9792 8.41473 11.45 8.41473 12C8.41473 12.55 8.2189 13.0208 7.82723 13.4125C7.43556 13.8042 6.96473 14 6.41473 14ZM12.4147 14C11.8647 14 11.3939 13.8042 11.0022 13.4125C10.6106 13.0208 10.4147 12.55 10.4147 12C10.4147 11.45 10.6106 10.9792 11.0022 10.5875C11.3939 10.1958 11.8647 10 12.4147 10C12.9647 10 13.4356 10.1958 13.8272 10.5875C14.2189 10.9792 14.4147 11.45 14.4147 12C14.4147 12.55 14.2189 13.0208 13.8272 13.4125C13.4356 13.8042 12.9647 14 12.4147 14ZM18.4147 14C17.8647 14 17.3939 13.8042 17.0022 13.4125C16.6106 13.0208 16.4147 12.55 16.4147 12C16.4147 11.45 16.6106 10.9792 17.0022 10.5875C17.3939 10.1958 17.8647 10 18.4147 10C18.9647 10 19.4356 10.1958 19.8272 10.5875C20.2189 10.9792 20.4147 11.45 20.4147 12C20.4147 12.55 20.2189 13.0208 19.8272 13.4125C19.4356 13.8042 18.9647 14 18.4147 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.99961 16.4999V5.9999H6.74961V7.4999H4.49961V14.9999H13.4996V7.4999H11.2496V5.9999H14.9996V16.4999H2.99961ZM8.24961 11.9999V3.61865L7.04961 4.81865L5.99961 3.7499L8.99961 0.749904L11.9996 3.7499L10.9496 4.81865L9.74961 3.61865V11.9999H8.24961Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M8.99961 11.9999L5.24961 8.2499L6.29961 7.1624L8.24961 9.1124V2.9999H9.74961V9.1124L11.6996 7.1624L12.7496 8.2499L8.99961 11.9999ZM2.99961 14.9999V11.2499H4.49961V13.4999H13.4996V11.2499H14.9996V14.9999H2.99961Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M10.0833 6.41667H11.9167V8.25H10.0833V6.41667ZM10.0833 10.0833H11.9167V15.5833H10.0833V10.0833ZM11 1.83333C5.94 1.83333 1.83333 5.94 1.83333 11C1.83333 16.06 5.94 20.1667 11 20.1667C16.06 20.1667 20.1667 16.06 20.1667 11C20.1667 5.94 16.06 1.83333 11 1.83333ZM11 18.3333C6.9575 18.3333 3.66667 15.0425 3.66667 11C3.66667 6.9575 6.9575 3.66667 11 3.66667C15.0425 3.66667 18.3333 6.9575 18.3333 11C18.3333 15.0425 15.0425 18.3333 11 18.3333Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 8.60253 11.6462" fill="none" aria-hidden="true">
      <path
        d="M1.01206 11.6462C0.733745 11.6462 0.495405 11.5323 0.29704 11.3044C0.0990134 11.0761 0 10.8019 0 10.4816V2.32924H1.01206V10.4816H6.57841V11.6462H1.01206ZM3.03619 9.31697C2.75787 9.31697 2.5197 9.20303 2.32167 8.97515C2.12331 8.74689 2.02413 8.47262 2.02413 8.15235V1.16462C2.02413 0.84435 2.12331 0.570082 2.32167 0.341816C2.5197 0.113939 2.75787 0 3.03619 0H7.59047C7.86879 0 8.10713 0.113939 8.30549 0.341816C8.50352 0.570082 8.60253 0.84435 8.60253 1.16462V8.15235C8.60253 8.47262 8.50352 8.74689 8.30549 8.97515C8.10713 9.20303 7.86879 9.31697 7.59047 9.31697H3.03619ZM3.03619 8.15235H7.59047V1.16462H3.03619V8.15235Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** MD3 "check" symbol — same traced glyph SearchMenu.tsx uses, marking a passed evaluation. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7.1625 13.5L2.8875 9.225L3.95625 8.15625L7.1625 11.3625L14.0438 4.48125L15.1125 5.55L7.1625 13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Real Material Symbols "play_arrow" (viewBox `0 -960 960 960`) — not in the mock itself, see this section's own header comment. */
function PlayIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M320-200v-560l440 280-440 280Z" fill="currentColor" />
    </svg>
  );
}

/** Self-drawn corner-bracket mark, not a recalled/traced icon-set glyph (the mock has no "expand" asset to trace — see this section's own header comment) — four independent strokes, deliberately simple so its geometry is obviously correct rather than a compound path that's hard to eyeball. */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2 6V2h4M12 2h4v4M16 12v4h-4M6 16H2v-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
