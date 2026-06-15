import { useState } from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { LuHistory, LuPlus } from "react-icons/lu";
import { formatDate, normalizeUtcIsoString } from "@/lib/helpers";
import type { PreviousExerciseSets } from "@/types";
import { formatPreviousSetLabel } from "./format";

const POPOVER_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;

type PreviousSetsButtonProps = {
  previousSets: PreviousExerciseSets;
  exerciseName: string;
  onFastAdd: () => void;
};

export function PreviousSetsButton({ previousSets, exerciseName, onFastAdd }: PreviousSetsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);

  const { floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy: "fixed",
    placement: "bottom-end",
    middleware: [
      offset(POPOVER_OFFSET_PX),
      flip({ padding: VIEWPORT_PADDING_PX }),
      shift({ padding: VIEWPORT_PADDING_PX }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: triggerElement, floating: panelElement },
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const handleToggleClick = () => {
    setIsOpen((previous) => !previous);
  };

  const handleFastAddClick = () => {
    onFastAdd();
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={setTriggerElement}
        type="button"
        className={[
          "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary",
          isOpen ? "bg-primary-100 text-primary ring-1 ring-primary-400 hover:bg-primary-100" : "",
        ].join(" ")}
        aria-label={isOpen ? `Hide last sets for ${exerciseName}` : `Show last sets for ${exerciseName}`}
        title="Last sets"
        {...getReferenceProps({ onClick: handleToggleClick })}
      >
        <LuHistory className="h-4 w-4" />
      </button>

      {isOpen ? (
        <FloatingPortal>
          <div
            ref={setPanelElement}
            role="dialog"
            aria-label={`Last sets for ${exerciseName}`}
            className="liquid-user-menu z-420 w-60 rounded-2xl p-3"
            style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
            {...getFloatingProps()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-2xs font-semibold uppercase tracking-widest text-muted">Last time</p>
                <p className="truncate text-sm font-semibold text-foreground" title={previousSets.workoutTitle}>
                  {previousSets.workoutTitle}
                </p>
                <p className="text-2xs font-medium text-secondary">
                  {formatDate(normalizeUtcIsoString(previousSets.workoutStartedAt))}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFastAddClick}
                className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-primary-300 bg-primary-100/10 px-2.5 text-2xs font-semibold text-primary transition hover:bg-primary-100/20 hover:text-primary-700"
                aria-label={`Add last sets to ${exerciseName}`}
                title="Add these sets"
              >
                <LuPlus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
            <ul className="liquid-divider flex flex-col gap-1.5 border-t pt-2">
              {previousSets.sets.map((set) => (
                <li key={set.setNumber} className="flex items-center justify-between gap-3 text-sm">
                  <span className="mono text-2xs font-semibold text-primary">#{set.setNumber}</span>
                  <span className="font-semibold tabular-nums text-secondary">
                    {formatPreviousSetLabel(set) ?? "-"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
