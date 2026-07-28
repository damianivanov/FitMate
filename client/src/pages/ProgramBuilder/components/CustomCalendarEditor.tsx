import { LuPlus, LuTrash2 } from "react-icons/lu";
import { TextInputField } from "@/shared/components";
import type { CustomDayEntry } from "../utils/builderState";

type CustomCalendarEditorProps = {
  customDays: CustomDayEntry[];
  minDate: string;
  maxDate: string;
  onPickTemplate: (localId: string) => void;
  onDateChange: (localId: string, date: string) => void;
  onAddDay: () => void;
  onRemoveDay: (localId: string) => void;
};

export function CustomCalendarEditor({
  customDays,
  minDate,
  maxDate,
  onPickTemplate,
  onDateChange,
  onAddDay,
  onRemoveDay,
}: CustomCalendarEditorProps) {
  const sortedDays = [...customDays].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Workout days</h2>
      <p className="text-xs text-secondary">
        Add each training day individually. Dates must fall inside the program range.
      </p>

      <div className="mt-2 grid gap-2">
        {sortedDays.map((day) => (
          <div
            key={day.localId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <TextInputField
              label="Date"
              type="date"
              min={minDate}
              max={maxDate}
              value={day.date}
              onChange={(event) => onDateChange(day.localId, event.target.value)}
              containerClassName="w-44"
            />

            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onPickTemplate(day.localId)}
                className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
              >
                <span className="truncate">{day.templateName ?? "Choose template"}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveDay(day.localId)}
                aria-label="Remove day"
                className="liquid-pill liquid-pill-danger shrink-0 cursor-pointer rounded-full p-2"
              >
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddDay}
        className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-(--glass-divider) px-4 text-sm font-semibold text-secondary transition-colors duration-200 hover:border-primary-300/60 hover:text-foreground"
      >
        <LuPlus className="h-4 w-4" />
        <span>Add workout day</span>
      </button>
    </section>
  );
}
