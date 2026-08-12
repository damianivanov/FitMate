import { LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";
import { SWIPE_ACTIONS_ATTRIBUTE, useSwipeReveal } from "@/shared/hooks/useSwipeReveal";
import type { BodyMetricEntry } from "@/types";

type WeightEntryRowProps = {
  entry: BodyMetricEntry;
  deltaKg: number | null;
  isOpen: boolean;
  isDeleting: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDelete: () => void;
};

/** Matches --wl-action-width in weight-log.css. */
const ACTION_WIDTH = 84;

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatEntryDate(value: string): string {
  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

export function WeightEntryRow({
  entry,
  deltaKg,
  isOpen,
  isDeleting,
  onOpenChange,
  onDelete,
}: WeightEntryRowProps) {
  const { trackRef, swipeHandlers } = useSwipeReveal({
    revealWidth: ACTION_WIDTH,
    isOpen,
    onOpenChange,
    disabled: isDeleting,
  });

  const weight = entry.bodyWeightKg != null ? formatNumber(entry.bodyWeightKg, 1) : "—";
  const meta = [
    formatEntryDate(entry.loggedAt),
    entry.bodyFatPercentage != null ? `${formatNumber(entry.bodyFatPercentage, 1)}% fat` : null,
    entry.notes,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="wl-row">
      <div ref={trackRef} className="wl-row-track" {...swipeHandlers}>
        <div className="wl-row-face">
          <div className="min-w-0">
            <p className="wl-row-value">
              {weight}
              <span className="wl-row-unit">kg</span>
            </p>
            <p className="wl-row-meta truncate">{meta}</p>
          </div>

          {deltaKg != null ? (
            <p className="wl-row-delta">
              {deltaKg > 0 ? "+" : deltaKg < 0 ? "−" : ""}
              {formatNumber(Math.abs(deltaKg), 1)}
            </p>
          ) : null}
        </div>

        <div className="wl-row-actions" {...{ [SWIPE_ACTIONS_ATTRIBUTE]: "" }}>
          <button
            type="button"
            className="wl-row-delete"
            disabled={isDeleting}
            aria-label={`Delete entry from ${formatEntryDate(entry.loggedAt)}`}
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
      </div>
    </li>
  );
}
