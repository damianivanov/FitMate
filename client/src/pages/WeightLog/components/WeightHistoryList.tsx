import { LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";
import type { BodyMetricEntry } from "@/types";

type WeightHistoryListProps = {
  entries: BodyMetricEntry[];
  deletingId: number | null;
  hasMore: boolean;
  onLoadMore: () => void;
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

export function WeightHistoryList({
  entries,
  deletingId,
  hasMore,
  onLoadMore,
  onDelete,
}: WeightHistoryListProps) {
  return (
    <div>
      <ul className="divide-y divide-(--glass-divider)">
        {entries.map((entry) => {
          const isDeleting = deletingId === entry.id;

          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {entry.bodyWeightKg != null ? `${formatNumber(entry.bodyWeightKg, 1)} kg` : "—"}
                  </span>
                  {entry.bodyFatPercentage != null ? (
                    <span className="text-2xs font-medium text-muted">
                      {formatNumber(entry.bodyFatPercentage, 1)}%
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-2xs text-muted">
                  {formatEntryDate(entry.loggedAt)}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onDelete(entry)}
                disabled={isDeleting}
                aria-label="Delete entry"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
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

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-2 w-full cursor-pointer rounded-full py-2 text-xs font-semibold uppercase tracking-wide text-secondary transition hover:text-primary"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
