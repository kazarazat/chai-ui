import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during server rendering on React 18; nothing runs
// there anyway.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * A ref that always holds the latest `value`, updated after each render
 * (not during it, per the rules of React). For stable callbacks that read
 * the newest options when they run, e.g. `submit` in an event handler.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
