import { create } from "zustand";
import type { User } from "@/types";
import { authService } from "@/services/authService";
import { loadStoredObject, saveStoredObject } from "@/lib/localStorage";

const STORAGE_KEY = "fitmate-cookie-consent";

// Bump to invalidate every stored decision and re-show the banner, e.g. when the
// Cookie Policy changes materially. loadStoredObject returns null on mismatch.
const STORAGE_VERSION = 1;

export type CookieDecision = {
  analytics: boolean;
  marketing: boolean;
  decidedAtUtc: string;
};

function isCookieDecision(value: unknown): value is CookieDecision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CookieDecision>;
  return (
    typeof candidate.analytics === "boolean"
    && typeof candidate.marketing === "boolean"
    && typeof candidate.decidedAtUtc === "string"
  );
}

function readStoredDecision(): CookieDecision | null {
  return loadStoredObject<CookieDecision>(STORAGE_KEY, {
    version: STORAGE_VERSION,
    validate: isCookieDecision,
  });
}

function writeStoredDecision(decision: CookieDecision): void {
  saveStoredObject(STORAGE_KEY, decision, STORAGE_VERSION);
}

function toDecision(user: User): CookieDecision | null {
  if (
    typeof user.cookieConsentAnalytics !== "boolean"
    || typeof user.cookieConsentMarketing !== "boolean"
  ) {
    return null;
  }

  return {
    analytics: user.cookieConsentAnalytics,
    marketing: user.cookieConsentMarketing,
    decidedAtUtc: user.cookieConsentAt ?? new Date().toISOString(),
  };
}

export interface ConsentState {
  decision: CookieDecision | null;
  isBannerOpen: boolean;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  reopenBanner: () => void;
  syncWithUser: (user: User) => Promise<void>;
}

const initialDecision = readStoredDecision();

export const useConsentStore = create<ConsentState>((set, get) => {
  const decide = async (analytics: boolean, marketing: boolean) => {
    const decision: CookieDecision = {
      analytics,
      marketing,
      decidedAtUtc: new Date().toISOString(),
    };

    writeStoredDecision(decision);
    set({ decision, isBannerOpen: false });

    // Persisting to the account is best-effort: anonymous visitors have no
    // account yet, and a failed write must never break the app.
    try {
      await authService.saveCookieConsent({ analytics, marketing });
    } catch {
    }
  };

  return {
    decision: initialDecision,
    isBannerOpen: initialDecision === null,

    acceptAll: async () => {
      await decide(true, true);
    },

    rejectAll: async () => {
      await decide(false, false);
    },

    reopenBanner: () => {
      set({ isBannerOpen: true });
    },

    syncWithUser: async (user: User) => {
      const serverDecision = toDecision(user);
      const localDecision = get().decision;

      // Server wins when the account already carries a decision.
      if (serverDecision) {
        writeStoredDecision(serverDecision);
        set({ decision: serverDecision, isBannerOpen: false });
        return;
      }

      // Account has no decision but this browser does: carry the anonymous
      // choice over so signing up does not re-prompt.
      if (localDecision) {
        try {
          await authService.saveCookieConsent({
            analytics: localDecision.analytics,
            marketing: localDecision.marketing,
          });
        } catch {
        }
        return;
      }

      set({ isBannerOpen: true });
    },
  };
});

export const isAnalyticsAllowed = (state: ConsentState) =>
  state.decision?.analytics === true;
