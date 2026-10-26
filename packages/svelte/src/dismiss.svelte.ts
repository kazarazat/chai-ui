/** While `open()`, a press outside `root()` or Escape calls `close`: the inline menus' popover behavior. */
export function useDismiss(root: () => HTMLElement | undefined, open: () => boolean, close: () => void) {
  $effect(() => {
    if (!open()) return;
    function onPointerDown(e: PointerEvent) {
      if (!root()?.contains(e.target as Node)) close();
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
    };
  });
}
