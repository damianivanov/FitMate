import { useState } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { LuCheck, LuDumbbell, LuX } from "react-icons/lu";
import { SET_TYPE_LABELS, getSetValueText } from "@/shared/utils/workoutSetDisplay";
import type { WorkoutExercise } from "@/types";

type ExerciseChipProps = {
  exercise: WorkoutExercise;
};

const POPOVER_OFFSET_PX = 10;
const VIEWPORT_PADDING_PX = 12;

function totalVolume(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
}

/**
 * The chip and the detail it opens are one object, so they live together: the popover is
 * anchored to the chip you pressed rather than taking over the screen from the middle, which
 * is what a modal did for what is only ever a glance at three numbers.
 */
export function ExerciseChip({ exercise }: ExerciseChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Elements held in state rather than refs: floating-ui needs them during render to
  // position, and reading a ref's `current` there is exactly what React tells you not to do.
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);

  const { floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy: "fixed",
    placement: "top",
    middleware: [
      offset(POPOVER_OFFSET_PX),
      flip({ padding: VIEWPORT_PADDING_PX }),
      shift({ padding: VIEWPORT_PADDING_PX }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: triggerElement, floating: panelElement },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  const name = exercise.exerciseName || `Exercise #${exercise.exerciseId}`;
  const completedCount = exercise.sets.filter((set) => set.isCompleted).length;
  const volume = totalVolume(exercise);
  const sortedSets = exercise.sets.slice().sort((left, right) => left.orderIndex - right.orderIndex);

  return (
    <>
      <button
        ref={setTriggerElement}
        type="button"
        className={`wk-ex ${isOpen ? "is-open" : ""}`}
        aria-label={`${name} details`}
        {...getReferenceProps()}
      >
        <span className="wk-ex-thumb">
          {exercise.exerciseImageUrl ? (
            <img src={exercise.exerciseImageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <LuDumbbell className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <small>{name}</small>
      </button>

      {isOpen ? (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            {/* Outer = floating-ui positioning (transform). Inner = the entrance keyframe
                (its own transform) — an animation outranks inline styles and `both` never
                gives the property back, so sharing one element parks the panel at 0,0. */}
            <div
              ref={setPanelElement}
              className="xp-anchor"
              style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
              aria-label={name}
              {...getFloatingProps()}
            >
              <div className="xp-pop">
                <div className="xp-head">
                  <b>{name}</b>
                  <button type="button" onClick={() => setIsOpen(false)} aria-label="Close">
                    <LuX className="h-4 w-4" />
                  </button>
                </div>

                <div className="xp-body">
                  {/* The picture is the fastest way to confirm you opened the right exercise,
                      so it holds its own column at full height rather than sitting above the
                      list and pushing the numbers off the bottom. */}
                  <div className="xp-side">
                    <span className="xp-photo">
                      {exercise.exerciseImageUrl ? (
                        <img src={exercise.exerciseImageUrl} alt="" loading="lazy" />
                      ) : (
                        <LuDumbbell className="h-7 w-7" aria-hidden="true" />
                      )}
                    </span>
                    <p>
                      <b>
                        {completedCount}/{exercise.sets.length}
                      </b>
                      <small>sets</small>
                    </p>
                    {volume > 0 ? (
                      <p>
                        <b>{Math.round(volume).toLocaleString()}</b>
                        <small>kg</small>
                      </p>
                    ) : null}
                  </div>

                  {sortedSets.length > 0 ? (
                    <ol className="xp-sets">
                      {sortedSets.map((set, index) => (
                        <li key={set.id} className={set.isCompleted ? "is-done" : ""}>
                          <span>{index + 1}</span>
                          <em>{SET_TYPE_LABELS[set.setType]}</em>
                          <b>{getSetValueText(set)}</b>
                          {set.isCompleted ? (
                            <LuCheck className="h-3 w-3" strokeWidth={3} aria-label="Completed" />
                          ) : (
                            <i aria-label="Not completed" />
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="xp-empty">No sets recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </>
  );
}
