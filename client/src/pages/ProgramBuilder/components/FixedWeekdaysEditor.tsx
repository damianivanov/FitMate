import { LuPlus, LuX } from "react-icons/lu";
import { WEEKDAY_NAMES } from "@/shared/utils/programDisplay";
import type { DayOfWeek } from "@/types";
import type { WeekdaySlot } from "../utils/builderState";

type FixedWeekdaysEditorProps = {
  weekdaySlots: WeekdaySlot[];
  onPickTemplate: (dayOfWeek: DayOfWeek) => void;
  onClear: (dayOfWeek: DayOfWeek) => void;
};

export function FixedWeekdaysEditor({
  weekdaySlots,
  onPickTemplate,
  onClear,
}: FixedWeekdaysEditorProps) {
  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Weekly schedule</h2>
      <p className="text-xs text-secondary">
        Pick a template for each training day. Days without a template are rest days.
      </p>

      <div className="mt-2 grid gap-2">
        {weekdaySlots.map((slot) => (
          <div
            key={slot.dayOfWeek}
            className="flex items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <span className="w-24 shrink-0 text-sm font-semibold text-foreground">
              {WEEKDAY_NAMES[slot.dayOfWeek]}
            </span>

            {slot.templateId !== null ? (
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onPickTemplate(slot.dayOfWeek)}
                  className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
                >
                  <span className="truncate">{slot.templateName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onClear(slot.dayOfWeek)}
                  aria-label={`Clear ${WEEKDAY_NAMES[slot.dayOfWeek]}`}
                  className="liquid-pill shrink-0 cursor-pointer rounded-full p-2"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onPickTemplate(slot.dayOfWeek)}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-(--glass-divider) px-3 text-xs font-semibold text-secondary transition-colors duration-200 hover:border-primary-300/60 hover:text-foreground"
              >
                <LuPlus className="h-3.5 w-3.5" />
                <span>Rest — add workout</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
