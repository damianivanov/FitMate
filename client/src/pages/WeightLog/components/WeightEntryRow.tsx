import { useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { LuChevronRight, LuLoaderCircle, LuScale, LuTrash2 } from "react-icons/lu";
import { formatNumber } from "@/lib/helpers";
import { SWIPE_ACTIONS_ATTRIBUTE, useSwipeReveal } from "@/shared/hooks/useSwipeReveal";
import type { WeightRow } from "../hooks/useWeightLogPage";
import { formatDelta, formatRelativeDay } from "../formatting";

type WeightEntryRowProps = {
  row: WeightRow;
  isEditing: boolean;
  isOpen: boolean;
  isDeleting: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: () => void;
  onDelete: () => void;
};

/** Matches --wl-action-width in weight-log.css. */
const ACTION_WIDTH = 84;

const TAP_SLOP = 8;

export function WeightEntryRow({
  row,
  isEditing,
  isOpen,
  isDeleting,
  onOpenChange,
  onSelect,
  onDelete,
}: WeightEntryRowProps) {
  const { entry, deltaKg, isLatest } = row;

  const { trackRef, swipeHandlers } = useSwipeReveal({
    revealWidth: ACTION_WIDTH,
    isOpen,
    onOpenChange,
    disabled: isDeleting || isEditing,
  });

  const press = useRef({ x: 0, y: 0, moved: false });

  const trackHandlers = useMemo(
    () => ({
      ...swipeHandlers,
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        press.current = { x: event.clientX, y: event.clientY, moved: false };
        swipeHandlers.onPointerDown(event);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
          Math.abs(event.clientX - press.current.x) > TAP_SLOP ||
          Math.abs(event.clientY - press.current.y) > TAP_SLOP
        ) {
          press.current.moved = true;
        }

        swipeHandlers.onPointerMove(event);
      },
    }),
    [swipeHandlers],
  );

  // Pointer capture retargets the press to the track, so a tap's click lands here and not on
  // the button inside it.
  const handleTrackClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditing || press.current.moved) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(`[${SWIPE_ACTIONS_ATTRIBUTE}]`)) {
      return;
    }

    if (isOpen) {
      onOpenChange(false);
      return;
    }

    onSelect();
  };

  const day = formatRelativeDay(entry.loggedAt);
  const weight = entry.bodyWeightKg != null ? formatNumber(entry.bodyWeightKg, 1) : "—";

  const face = (
    <>
      <span className={`wl-row-tile${isLatest ? " wl-row-tile-latest" : ""}`} aria-hidden="true">
        <LuScale className="h-4 w-4" />
      </span>

      <span className="wl-row-text">
        <span className="wl-row-title">{day}</span>
        <span className="wl-row-sub">{formatDelta(deltaKg)}</span>
      </span>

      <span className="wl-row-value">
        {weight}
        <span className="wl-row-unit">kg</span>
      </span>
    </>
  );

  return (
    <li className="wl-row">
      <div ref={trackRef} className="wl-row-track" onClick={handleTrackClick} {...trackHandlers}>
        {isEditing ? (
          <div className="wl-row-face wl-row-face-static">
            {face}

            <button
              type="button"
              className="wl-row-remove"
              disabled={isDeleting}
              aria-label={`Delete the entry from ${day}`}
              onClick={onDelete}
            >
              {isDeleting ? (
                <LuLoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LuTrash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="wl-row-face" aria-label={`${day}, ${weight} kilograms`}>
              {face}

              <LuChevronRight
                className="wl-row-chevron h-[1.125rem] w-[1.125rem]"
                aria-hidden="true"
              />
            </button>

            <div className="wl-row-actions" {...{ [SWIPE_ACTIONS_ATTRIBUTE]: "" }}>
              <button
                type="button"
                className="wl-row-delete"
                disabled={isDeleting}
                aria-label={`Delete the entry from ${day}`}
                onFocus={() => onOpenChange(true)}
                onBlur={() => onOpenChange(false)}
                onClick={onDelete}
              >
                {isDeleting ? (
                  <LuLoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LuTrash2 className="h-4 w-4" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
