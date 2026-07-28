import { LuBedDouble, LuPlus, LuTrash2 } from "react-icons/lu";
import type { RotationSlot } from "../utils/builderState";

type RotationEditorProps = {
  rotationSlots: RotationSlot[];
  onPickTemplate: (localId: string) => void;
  onSetRest: (localId: string) => void;
  onAddDay: () => void;
  onRemoveDay: (localId: string) => void;
};

export function RotationEditor({
  rotationSlots,
  onPickTemplate,
  onSetRest,
  onAddDay,
  onRemoveDay,
}: RotationEditorProps) {
  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Rotation cycle</h2>
      <p className="text-xs text-secondary">
        The cycle repeats from Day 1 after the last day, independent of weekdays.
      </p>

      <div className="mt-2 grid gap-2">
        {rotationSlots.map((slot, index) => (
          <div
            key={slot.localId}
            className="flex items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <span className="w-16 shrink-0 text-sm font-semibold text-foreground">
              Day {index + 1}
            </span>

            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {slot.isRest ? (
                <button
                  type="button"
                  onClick={() => onPickTemplate(slot.localId)}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-(--glass-divider) px-3 text-xs font-semibold text-secondary transition-colors duration-200 hover:border-primary-300/60 hover:text-foreground"
                >
                  <LuBedDouble className="h-3.5 w-3.5" />
                  <span>Rest — add workout</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onPickTemplate(slot.localId)}
                    className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
                  >
                    <span className="truncate">{slot.templateName ?? "Choose template"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetRest(slot.localId)}
                    className="liquid-pill shrink-0 cursor-pointer rounded-full px-3 py-2 text-xs font-semibold"
                  >
                    Rest
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onRemoveDay(slot.localId)}
                aria-label={`Remove day ${index + 1}`}
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
        <span>Add day</span>
      </button>
    </section>
  );
}
