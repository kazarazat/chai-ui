export interface Slide {
  /** The image paged away from, shown sliding out. Absent when it wasn't an image. */
  from?: string;
  forward: boolean;
  key: number;
  active: boolean;
}

/**
 * The slide between pages of a card: the new page comes in from the side it
 * was paged from while the last one leaves the other way. `page` gives the
 * page showing, its index, and its image, if it has one (what slides out next time).
 */
export function usePageSlide(page: () => { id: string | undefined; index: number; image: string | undefined }) {
  let slide = $state<Slide | null>(null);
  let shown = page();
  // Before the DOM updates, so the outgoing image renders with the new page.
  $effect.pre(() => {
    const next = page();
    if (next.id === shown.id && next.index === shown.index && next.image === shown.image) return;
    // No slide for someone who has asked their system for less motion.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (next.id !== shown.id && shown.id !== undefined && next.id !== undefined && !reduceMotion) {
      slide = { from: shown.image, forward: next.index > shown.index, key: (slide?.key ?? 0) + 1, active: true };
    }
    // The same page getting its image (a result arriving) doesn't slide.
    shown = next;
  });
  return {
    get slide() {
      return slide;
    },
    endSlide() {
      if (slide) slide = { ...slide, active: false, from: undefined };
    },
  };
}
