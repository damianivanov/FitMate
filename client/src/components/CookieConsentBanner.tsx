import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { OutlinedButton } from "@/shared/components/Buttons";
import { useConsentStore } from "@/stores/consentStore";
import { useUserStore } from "@/stores/userStore";

export default function CookieConsentBanner() {
  const isBannerOpen = useConsentStore((state) => state.isBannerOpen);
  const acceptAll = useConsentStore((state) => state.acceptAll);
  const rejectAll = useConsentStore((state) => state.rejectAll);
  const { userLoaded, isAuthenticated } = useUserStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBannerOpen) {
      containerRef.current?.focus();
    }
  }, [isBannerOpen]);

  if (!isBannerOpen || !userLoaded) {
    return null;
  }

  const bottomOffsetClassName = isAuthenticated
    ? "bottom-24 md:bottom-4"
    : "bottom-4";

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      tabIndex={-1}
      className={`pointer-events-none fixed inset-x-0 z-[var(--z-nav)] px-3 outline-none ${bottomOffsetClassName}`}
    >
      <div className="liquid-surface liquid-modal-surface pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">We use cookies</p>
          <p className="text-xs text-secondary">
            Essential cookies keep you signed in and your workouts saved. We do not
            use analytics or advertising cookies today.{" "}
            <Link to="/legal#cookies" className="liquid-link font-semibold">
              Cookie Policy
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <OutlinedButton size="sm" className="flex-1 md:flex-none" onClick={rejectAll}>
            Reject all
          </OutlinedButton>
          <OutlinedButton size="sm" className="flex-1 md:flex-none" onClick={acceptAll}>
            Accept all
          </OutlinedButton>
        </div>
      </div>
    </div>
  );
}
