import { useEffect, useState } from "react";
import { LuClock, LuDumbbell, LuSparkles } from "react-icons/lu";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import { Modal } from "@/shared/components";
import { SET_TYPE_LABELS } from "@/shared/utils/workoutSetDisplay";
import { formatMetricValue } from "@/pages/WorkoutBuilder/utils/workoutDraft";
import type { AIActionDetailModel, AIProposalExerciseModel, AIProposalSetModel } from "@/types";

type ProposalDetailModalProps = {
  actionId: number | null;
  onClose: () => void;
};

/** weight × reps when both are prescribed, otherwise whichever half the coach actually set. */
function setValueText(set: AIProposalSetModel): string {
  const weight = formatMetricValue(set.weightKg);
  const reps = formatMetricValue(set.reps);

  if (weight && reps) {
    return `${weight} kg × ${reps}`;
  }

  if (reps) {
    return `${reps} reps`;
  }

  if (weight) {
    return `${weight} kg`;
  }

  return "-";
}

function ExerciseRow({
  exercise,
  onViewImage,
}: {
  exercise: AIProposalExerciseModel;
  onViewImage: (exercise: AIProposalExerciseModel) => void;
}) {
  const muscles = [exercise.primaryMuscleGroupName, exercise.secondaryMuscleGroupName]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="liquid-divider flex gap-3 border-b py-3 last:border-b-0">
      {exercise.imageUrl ? (
        <button
          type="button"
          onClick={() => onViewImage(exercise)}
          className="h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl"
          aria-label={`View ${exercise.name}`}
        >
          <img src={exercise.imageUrl} alt="" className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-200 text-primary">
          <LuDumbbell className="h-6 w-6" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-bold text-foreground">{exercise.name}</p>
          {exercise.isNew ? (
            <span className="shrink-0 text-xs font-semibold tracking-wide text-secondary uppercase">
              New
            </span>
          ) : null}
        </div>

        {muscles ? <p className="mt-0.5 truncate text-xs text-muted">{muscles}</p> : null}

        <ul className="mt-2 flex flex-col gap-1">
          {exercise.sets.map((set, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">
                {index + 1}. {SET_TYPE_LABELS[set.setType]}
              </span>
              <span className="text-right font-medium text-foreground">
                {setValueText(set)}
                {set.rpe != null ? (
                  <span className="ml-2 text-xs text-muted">RPE {formatMetricValue(set.rpe)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function ProposalDetailModal({ actionId, onClose }: ProposalDetailModalProps) {
  const [detail, setDetail] = useState<AIActionDetailModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<AIProposalExerciseModel | null>(null);

  useEffect(() => {
    if (actionId == null) {
      return;
    }

    let isStale = false;
    setDetail(null);
    setError(null);
    setZoomed(null);
    setIsLoading(true);

    async function load(id: number) {
      try {
        const response = await aiService.getActionDetail(id);
        const loaded = unwrap(response.data, "Unable to open the suggestion.");
        if (!isStale) {
          setDetail(loaded);
        }
      } catch (loadError) {
        if (!isStale) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to open the suggestion.",
          );
        }
      } finally {
        if (!isStale) {
          setIsLoading(false);
        }
      }
    }

    void load(actionId);

    return () => {
      isStale = true;
    };
  }, [actionId]);

  const setCount = detail?.exercises.reduce((total, item) => total + item.sets.length, 0) ?? 0;

  return (
    <>
      <Modal
        isOpen={actionId != null}
        onClose={onClose}
        title={detail?.title ?? "Suggestion"}
        titleIcon={<LuSparkles className="h-5 w-5" />}
        maxWidth="lg"
      >
        <div className="p-5 md:p-6">
          {isLoading ? (
            <p className="py-6 text-center text-sm font-semibold text-secondary">Loading...</p>
          ) : error ? (
            <p role="alert" className="py-6 text-center text-sm text-danger">
              {error}
            </p>
          ) : detail == null || detail.exercises.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              This suggestion has no exercises to show.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <LuDumbbell className="h-4 w-4" />
                  {detail.exercises.length} exercises · {setCount} sets
                </span>
                {detail.estimatedDurationMinutes > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <LuClock className="h-4 w-4" />
                    about {detail.estimatedDurationMinutes} min
                  </span>
                ) : null}
              </div>

              {detail.notes ? (
                <p className="mt-3 text-sm text-secondary">{detail.notes}</p>
              ) : null}

              <ul className="mt-4 flex flex-col">
                {detail.exercises.map((exercise, index) => (
                  <ExerciseRow
                    key={`${exercise.exerciseId}-${index}`}
                    exercise={exercise}
                    onViewImage={setZoomed}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={zoomed != null}
        onClose={() => setZoomed(null)}
        variant="image"
        maxWidth="lg"
      >
        {zoomed?.imageUrl ? (
          <img src={zoomed.imageUrl} alt={zoomed.name} className="w-full object-contain" />
        ) : null}
      </Modal>
    </>
  );
}
