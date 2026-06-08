import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Modal } from "@/shared/components";
import { MONTH_LABELS } from "../utils/calendar";

type MonthPickerModalProps = {
  isOpen: boolean;
  viewYear: number;
  viewMonth: number;
  onClose: () => void;
  onSelect: (year: number, month: number) => void;
};

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const MIN_YEAR = CURRENT_YEAR - 6;
const MAX_YEAR = CURRENT_YEAR;

function isFutureMonth(year: number, month: number): boolean {
  return year > CURRENT_YEAR || (year === CURRENT_YEAR && month > CURRENT_MONTH);
}

type MonthPickerBodyProps = Pick<MonthPickerModalProps, "isOpen" | "viewYear" | "viewMonth" | "onSelect">;

function MonthPickerBody({ isOpen, viewYear, viewMonth, onSelect }: MonthPickerBodyProps) {
  const [pickerYear, setPickerYear] = useState(viewYear);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setPickerYear(viewYear);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPickerYear((year) => Math.max(MIN_YEAR, year - 1))}
          disabled={pickerYear <= MIN_YEAR}
          aria-label="Previous year"
          className="liquid-pill inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xl font-bold text-foreground">{pickerYear}</span>
        <button
          type="button"
          onClick={() => setPickerYear((year) => Math.min(MAX_YEAR, year + 1))}
          disabled={pickerYear >= MAX_YEAR}
          aria-label="Next year"
          className="liquid-pill inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTH_LABELS.map((label, index) => {
          const month = index + 1;
          const future = isFutureMonth(pickerYear, month);
          const isCurrent = pickerYear === viewYear && month === viewMonth;

          return (
            <button
              key={label}
              type="button"
              disabled={future}
              aria-pressed={isCurrent}
              onClick={() => onSelect(pickerYear, month)}
              className={[
                "rounded-xl px-2 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-30",
                isCurrent
                  ? "bg-primary font-bold text-white"
                  : "liquid-soft-surface cursor-pointer text-foreground hover:bg-primary-100/15",
              ].join(" ")}
            >
              {label.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthPickerModal({ isOpen, viewYear, viewMonth, onClose, onSelect }: MonthPickerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Jump to month" maxWidth="sm">
      <MonthPickerBody isOpen={isOpen} viewYear={viewYear} viewMonth={viewMonth} onSelect={onSelect} />
    </Modal>
  );
}
