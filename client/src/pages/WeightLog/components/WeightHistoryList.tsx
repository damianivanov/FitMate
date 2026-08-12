import { useState } from "react";
import type { BodyMetricEntry } from "@/types";
import { WeightEntryRow } from "./WeightEntryRow";

type WeightHistoryListProps = {
  entries: BodyMetricEntry[];
  deletingId: number | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onDelete: (entry: BodyMetricEntry) => void;
};

function getDelta(entries: BodyMetricEntry[], index: number): number | null {
  const current = entries[index]?.bodyWeightKg;
  const previous = entries[index + 1]?.bodyWeightKg;

  return current != null && previous != null ? current - previous : null;
}

export function WeightHistoryList({
  entries,
  deletingId,
  hasMore,
  onLoadMore,
  onDelete,
}: WeightHistoryListProps) {
  // One row at a time: opening another closes the last, so the page never holds two
  // half-finished gestures.
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div>
      <ul className="wl-list">
        {entries.map((entry, index) => (
          <WeightEntryRow
            key={entry.id}
            entry={entry}
            deltaKg={getDelta(entries, index)}
            isOpen={openId === entry.id}
            isDeleting={deletingId === entry.id}
            onOpenChange={(isOpen) => setOpenId(isOpen ? entry.id : null)}
            onDelete={() => onDelete(entry)}
          />
        ))}
      </ul>

      {hasMore ? (
        <button type="button" className="wl-load-more" onClick={onLoadMore}>
          Load more
        </button>
      ) : null}
    </div>
  );
}
