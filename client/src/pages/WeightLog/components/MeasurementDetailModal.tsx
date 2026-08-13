import { LuTrash2 } from "react-icons/lu";
import { formatNumber } from "@/lib/helpers";
import { Modal } from "@/shared/components";
import type { BodyMetricEntry } from "@/types";
import { formatDelta, formatFullDate } from "../formatting";

type MeasurementDetailModalProps = {
  isOpen: boolean;
  entry: BodyMetricEntry | null;
  deltaKg: number | null;
  onClose: () => void;
  onDelete: () => void;
};

export function MeasurementDetailModal({
  isOpen,
  entry,
  deltaKg,
  onClose,
  onDelete,
}: MeasurementDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Measurement" maxWidth="sm">
      {entry ? (
        <div className="wl-detail">
          <p className="wl-detail-date">{formatFullDate(entry.loggedAt)}</p>

          <p className="wl-detail-value">
            {entry.bodyWeightKg != null ? formatNumber(entry.bodyWeightKg, 1) : "—"}
            <span className="wl-detail-unit">kg</span>
          </p>

          <p className="wl-detail-delta">{formatDelta(deltaKg)}</p>

          {entry.bodyFatPercentage != null ? (
            <div className="wl-detail-row">
              <span className="wl-detail-key">Body fat</span>
              <span className="wl-detail-fact">{formatNumber(entry.bodyFatPercentage, 1)}%</span>
            </div>
          ) : null}

          {entry.notes ? (
            <div className="wl-detail-row wl-detail-row-stacked">
              <span className="wl-detail-key">Note</span>
              <span className="wl-detail-note">{entry.notes}</span>
            </div>
          ) : null}

          <button type="button" className="wl-detail-delete" onClick={onDelete}>
            <LuTrash2 className="h-4 w-4" />
            <span>Delete measurement</span>
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
