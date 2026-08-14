import { LuDumbbell, LuLoaderCircle, LuPencil, LuPlay, LuTrash2 } from "react-icons/lu";
import {
  AsyncSection,
  BackHeader,
  DeleteConfirmationModal,
  NativeGlyph,
  NativeHero,
  NativeList,
  NativePage,
  NativeRow,
  NativeSection,
  PageBody,
} from "@/shared/components";
import { useTemplatePreviewPage } from "./hooks/useTemplatePreviewPage";
import type { WorkoutTemplate, WorkoutTemplateExercise } from "@/types";

function getExercises(template: WorkoutTemplate): WorkoutTemplateExercise[] {
  return template.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) =>
      group.exercises.slice().sort((left, right) => left.orderIndex - right.orderIndex),
    );
}

function describeSets(exercise: WorkoutTemplateExercise): string {
  const setCount = exercise.sets.length;

  if (setCount === 0) {
    return "No sets";
  }

  const reps = exercise.sets
    .map((set) => set.reps)
    .filter((value): value is number => value != null);

  if (reps.length === 0) {
    return `${setCount} set${setCount === 1 ? "" : "s"}`;
  }

  const low = Math.min(...reps);
  const high = Math.max(...reps);

  return `${setCount} × ${low === high ? low : `${low}–${high}`}`;
}

export default function TemplatePreview() {
  const { state, actions } = useTemplatePreviewPage();
  const template = state.template;

  const summary = template
    ? [
        `${template.exerciseCount} exercise${template.exerciseCount === 1 ? "" : "s"}`,
        `${template.setCount} set${template.setCount === 1 ? "" : "s"}`,
        template.estimatedDurationMinutes ? `about ${template.estimatedDurationMinutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <PageBody>
        <NativePage>
          <BackHeader
            title="Template"
            onBack={actions.back}
            action={
              <button
                type="button"
                onClick={actions.edit}
                disabled={!state.isActionable}
                className="app-round-btn liquid-press disabled:opacity-60"
                aria-label="Edit template"
              >
                <LuPencil className="h-4 w-4" />
              </button>
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading template..."
          >
            {template ? (
              <>
                <NativeHero centred>
                  <NativeGlyph tint="orange" size="lg">
                    <LuDumbbell className="h-6 w-6" />
                  </NativeGlyph>
                  <p>Workout template</p>
                  <h2>{template.name}</h2>
                  <small>{summary}</small>

                  <button
                    type="button"
                    onClick={actions.start}
                    disabled={!state.isActionable || state.isStartingTemplate}
                    className="native-primary-action mt-5 max-w-xs"
                  >
                    {state.isStartingTemplate ? (
                      <LuLoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <LuPlay className="h-4 w-4" fill="currentColor" />
                    )}
                    {state.isStartingTemplate ? "Starting" : "Start workout"}
                  </button>
                </NativeHero>

                {template.description ? (
                  <NativeSection title="About">
                    <div className="native-card px-4 py-4 text-sm leading-relaxed text-secondary">
                      {template.description}
                    </div>
                  </NativeSection>
                ) : null}

                <NativeSection title="Exercises">
                  <NativeList>
                    {getExercises(template).map((exercise) => (
                      <NativeRow
                        key={exercise.id}
                        glyph={
                          <NativeGlyph tint="orange">
                            <LuDumbbell className="h-5 w-5" />
                          </NativeGlyph>
                        }
                        title={exercise.exerciseName || `Exercise #${exercise.exerciseId}`}
                        subtitle={describeSets(exercise)}
                      />
                    ))}
                  </NativeList>
                </NativeSection>

                <button
                  type="button"
                  onClick={actions.requestDelete}
                  disabled={!state.isActionable || state.isDeleting}
                  className="native-ghost-action tp-delete"
                >
                  {state.isDeleting ? (
                    <LuLoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <LuTrash2 className="h-4 w-4" />
                  )}
                  Delete template
                </button>
              </>
            ) : null}
          </AsyncSection>
        </NativePage>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.templateName}
        title="Delete template"
        isDeleting={state.isDeleting}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
