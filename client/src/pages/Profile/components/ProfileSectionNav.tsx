import type { CSSProperties } from "react";
import { NavLink, useLocation } from "react-router";
import { LuDumbbell, LuTarget, LuUserRound } from "react-icons/lu";
import { useSegmentedThumb } from "@/shared/hooks/useSegmentedThumb";
import { tick } from "@/shared/utils/haptics";

const PROFILE_SECTIONS = [
  { label: "Account", to: ".", icon: LuUserRound, end: true },
  { label: "Training", to: "training", icon: LuTarget, end: false },
  { label: "Exercises", to: "exercises", icon: LuDumbbell, end: false },
];

export function ProfileSectionNav() {
  const { pathname } = useLocation();

  const matchedIndex = PROFILE_SECTIONS.findIndex(
    (section) => !section.end && pathname.endsWith(`/${section.to}`),
  );
  const activeIndex = matchedIndex >= 0 ? matchedIndex : 0;

  const { thumbRef } = useSegmentedThumb(activeIndex);

  return (
    <nav
      aria-label="Profile sections"
      className="liquid-segmented w-full lg:w-auto"
      style={{ "--liquid-segment-count": PROFILE_SECTIONS.length } as CSSProperties}
    >
      <span ref={thumbRef} aria-hidden="true" className="liquid-segment-thumb" />

      {PROFILE_SECTIONS.map((section) => {
        const Icon = section.icon;

        return (
          <div key={section.label} className="min-w-0 flex-1">
            <NavLink
              to={section.to}
              end={section.end}
              onClick={() => tick()}
              className="liquid-segment h-10 px-4 text-xs"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{section.label}</span>
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}
