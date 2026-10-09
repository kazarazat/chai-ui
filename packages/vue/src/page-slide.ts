import { ref, watch } from "vue";

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
  const slide = ref<Slide | null>(null);
  let shown = page();
  watch(page, (next) => {
    // No slide for someone who has asked their system for less motion.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (next.id !== shown.id && shown.id !== undefined && next.id !== undefined && !reduceMotion) {
      slide.value = { from: shown.image, forward: next.index > shown.index, key: (slide.value?.key ?? 0) + 1, active: true };
    }
    // The same page getting its image (a result arriving) doesn't slide.
    shown = next;
  });
  const endSlide = () => {
    if (slide.value) slide.value = { ...slide.value, active: false, from: undefined };
  };
  return { slide, endSlide };
}
