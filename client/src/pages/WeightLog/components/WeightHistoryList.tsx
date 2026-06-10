import { LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";
import type { BodyMetricEntry } from "@/types";

type WeightHistoryListProps = {
  entries: BodyMetricEntry[];
  deletingId: number | null;
  onDelete: (entry: BodyMetricEntry) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatEntryDate(value: string): string {
  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

export function WeightHistoryList({ entries, deletingId, onDelete }: WeightHistoryListProps) {
  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        const isDeleting = deletingId === entry.id;

        return (
          <li
            key={entry.id}
            className="liquid-panel flex items-start justify-between gap-3 rounded-xl px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-foreground">
                <span>{entry.bodyWeightKg != null ? `${formatNumber(entry.bodyWeightKg, 1)} kg` : "—"}</span>
                {entry.bodyFatPercentage != null ? (
                  <span className="text-xs font-semibold text-secondary">
                    {formatNumber(entry.bodyFatPercentage, 1)}% fat
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-secondary">{formatEntryDate(entry.loggedAt)}</p>
              {entry.notes ? (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">{entry.notes}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onDelete(entry)}
              disabled={isDeleting}
              aria-label="Delete entry"
              className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-secondary transition hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <LuLoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LuTrash2 className="h-4 w-4" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
