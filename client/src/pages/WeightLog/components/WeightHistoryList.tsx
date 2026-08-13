import { useState } from "react";
import type { BodyMetricEntry } from "@/types";
import type { WeightRow } from "../hooks/useWeightLogPage";
import { WeightEntryRow } from "./WeightEntryRow";

type WeightHistoryListProps = {
  rows: WeightRow[];
  deletingId: number | null;
  hasMore: boolean;
  isEditing: boolean;
  onLoadMore: () => void;
  onSelect: (entry: BodyMetricEntry) => void;
  onDelete: (entry: BodyMetricEntry) => void;
};

export function WeightHistoryList({
  rows,
  deletingId,
  hasMore,
  isEditing,
  onLoadMore,
  onSelect,
  onDelete,
}: WeightHistoryListProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  const revealedId = isEditing ? null : openId;

  return (
    <div>
      <ul className="wl-list">
        {rows.map((row) => (
          <WeightEntryRow
            key={row.entry.id}
            row={row}
            isEditing={isEditing}
            isOpen={revealedId === row.entry.id}
            isDeleting={deletingId === row.entry.id}
            onOpenChange={(isOpen) => setOpenId(isOpen ? row.entry.id : null)}
            onSelect={() => onSelect(row.entry)}
            onDelete={() => onDelete(row.entry)}
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
