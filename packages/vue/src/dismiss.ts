import { onScopeDispose, watch, type Ref } from "vue";

/** While `open`, a press outside `root` or Escape calls `close`: the inline menus' popover behavior. */
export function useDismiss(root: Ref<HTMLElement | undefined>, open: Ref<boolean>, close: () => void) {
  function onPointerDown(e: PointerEvent) {
    if (!root.value?.contains(e.target as Node)) close();
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  function listen(on: boolean) {
    if (on) {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeydown);
    } else {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
    }
  }
  watch(open, listen);
  onScopeDispose(() => listen(false));
}
