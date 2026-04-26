import { useCallback, useMemo, useSyncExternalStore } from "react";

const DEFAULT_MAX_WIDTH_PX = 767;

type UseIsMobileViewportOptions = {
  maxWidthPx?: number;
  defaultValue?: boolean;
};

function getMediaQuery(maxWidthPx: number): string {
  return `(max-width: ${maxWidthPx}px)`;
}

function getMediaQueryMatch(mediaQuery: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return defaultValue;
  }

  return window.matchMedia(mediaQuery).matches;
}

function subscribeToMediaQuery(mediaQuery: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(mediaQuery);
  const handleMediaQueryChange = () => {
    onStoreChange();
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleMediaQueryChange);
    return () => {
      mediaQueryList.removeEventListener("change", handleMediaQueryChange);
    };
  }

  mediaQueryList.addListener(handleMediaQueryChange);
  return () => {
    mediaQueryList.removeListener(handleMediaQueryChange);
  };
}

export function useIsMobileViewport(options: UseIsMobileViewportOptions = {}): boolean {
  const { maxWidthPx = DEFAULT_MAX_WIDTH_PX, defaultValue = false } = options;
  const mediaQuery = useMemo(() => getMediaQuery(maxWidthPx), [maxWidthPx]);
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToMediaQuery(mediaQuery, onStoreChange),
    [mediaQuery],
  );
  const getSnapshot = useCallback(
    () => getMediaQueryMatch(mediaQuery, defaultValue),
    [defaultValue, mediaQuery],
  );
  const getServerSnapshot = useCallback(
    () => defaultValue,
    [defaultValue],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
