import { useCallback, useSyncExternalStore } from "react";

/**
 * Detects whether the app is running as an installed PWA (standalone display
 * mode) rather than inside a normal browser tab, and reflects that on the
 * document root via the `pwa-standalone` class so CSS can adapt (e.g. extend
 * the top bar into the status-bar safe area, lift the bottom nav).
 */

const DISPLAY_MODE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
] as const;

const PWA_CLASS = "pwa-standalone";

type IosNavigator = Navigator & { standalone?: boolean };

function detectStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const matchesDisplayMode =
    typeof window.matchMedia === "function" &&
    DISPLAY_MODE_QUERIES.some((query) => window.matchMedia(query).matches);

  // iOS Safari (legacy, pre display-mode support) exposes navigator.standalone.
  const isIosStandalone = (window.navigator as IosNavigator).standalone === true;

  return matchesDisplayMode || isIosStandalone;
}

/**
 * Toggles the `pwa-standalone` class on <html>. Call once on startup (before
 * first paint) to avoid a flash, then again whenever the display mode changes.
 */
export function applyPwaDisplayModeClass(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(PWA_CLASS, detectStandalone());
}

function subscribeToDisplayMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryLists = DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query));
  const handleChange = () => {
    applyPwaDisplayModeClass();
    onStoreChange();
  };

  mediaQueryLists.forEach((mediaQueryList) => {
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
    } else {
      mediaQueryList.addListener(handleChange);
    }
  });

  return () => {
    mediaQueryLists.forEach((mediaQueryList) => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    });
  };
}

export function useIsPwa(): boolean {
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribeToDisplayMode, detectStandalone, getServerSnapshot);
}

/* ----------------------------------------------------------------
   Install prompt (Add to Home Screen)
   ---------------------------------------------------------------- */

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

// `beforeinstallprompt` can fire before the app bundle executes, so the
// authoritative capture lives in an inline <script> in index.html that stashes
// the event on window.__pwaInstallPrompt and dispatches "pwa-install-change".
// We mirror that capture here as a fallback and observe the same slot.
const INSTALL_CHANGE_EVENT = "pwa-install-change";

function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__pwaInstallPrompt ?? null;
}

function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__pwaInstallPrompt = event;
  window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
}

// Fallback capture for the case where the inline script in index.html is ever
// absent; both writers target the same window slot, so this is idempotent.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => {
    setDeferredInstallPrompt(null);
  });
}

function subscribeToInstallPrompt(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(INSTALL_CHANGE_EVENT, onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    window.removeEventListener(INSTALL_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

/** iOS has no programmatic install prompt — only manual "Add to Home Screen". */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const isIosUserAgent = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // iPadOS 13+ reports as a Mac; disambiguate via touch support.
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIosUserAgent || isIpadOs;
}

export type PwaInstall = {
  /** A Chromium browser fired beforeinstallprompt — the native prompt is available. */
  canPrompt: boolean;
  /** iOS (no prompt API) — the UI should show Add-to-Home-Screen guidance instead. */
  isIos: boolean;
  /** Triggers the native install prompt; resolves true when the user accepts. */
  promptInstall: () => Promise<boolean>;
};

export function usePwaInstall(): PwaInstall {
  const getServerSnapshot = useCallback(() => false, []);
  const canPrompt = useSyncExternalStore(
    subscribeToInstallPrompt,
    () => getDeferredInstallPrompt() !== null,
    getServerSnapshot,
  );

  const promptInstall = useCallback(async () => {
    const promptEvent = getDeferredInstallPrompt();
    if (!promptEvent) {
      return false;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    // The prompt can only be used once; drop it regardless of the outcome.
    setDeferredInstallPrompt(null);
    return choice.outcome === "accepted";
  }, []);

  return { canPrompt, isIos: isIosDevice(), promptInstall };
}
