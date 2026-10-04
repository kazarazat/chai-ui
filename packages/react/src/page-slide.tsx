import { useState, type ReactNode } from "react";

interface Slide {
  /** The image paged away from, shown sliding out. Absent when it wasn't an image. */
  from?: string;
  forward: boolean;
  key: number;
  active: boolean;
}

/**
 * The slide between pages of a card: the new page comes in from the side it
 * was paged from while the last one leaves the other way. `id` is the page
 * showing and `image` its image, if it has one (what slides out next time).
 */
export function usePageSlide(id: string | undefined, index: number, image: string | undefined) {
  const [shown, setShown] = useState({ id, index, image });
  const [slide, setSlide] = useState<Slide | null>(null);
  // Tracked while rendering, not in an effect (the rules of React).
  if (id !== shown.id) {
    setShown({ id, index, image });
    // No slide for someone who has asked their system for less motion.
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (shown.id !== undefined && id !== undefined && !reduceMotion) {
      setSlide({ from: shown.image, forward: index > shown.index, key: (slide?.key ?? 0) + 1, active: true });
    }
  } else if (image !== shown.image) {
    // The same page getting its image (a result arriving) doesn't slide.
    setShown({ ...shown, image });
  }
  return { slide, endSlide: () => setSlide((s) => s && { ...s, active: false, from: undefined }) };
}

/**
 * Renders a page with its slide. The outgoing image stays in the layout
 * while it slides away, so the card holds its height even while the new
 * image is still loading, and the new page slides in over that space. The
 * page keeps its key once the slide ends, so it isn't remounted (no
 * reloaded image, no restarted video).
 */
export function PageSlide({
  slide,
  onEnd,
  className,
  children,
}: {
  slide: Slide | null;
  onEnd: () => void;
  className?: string;
  children: ReactNode;
}) {
  const side = slide?.forward ? "left" : "right";
  const outgoing = slide?.active && slide.from;
  return (
    <>
      {outgoing && (
        <img
          key={`out-${slide.key}`}
          className={`chai-slide-out chai-slide-out--${side}`}
          src={slide.from}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      <div
        key={`in-${slide?.key ?? 0}`}
        className={
          [className, slide?.active && `chai-slide-in chai-slide-in--${side}`, outgoing && "chai-slide-in--over"]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onEnd();
        }}
      >
        {children}
      </div>
    </>
  );
}
