import { useNavigate } from "react-router";
import { LuDumbbell, LuLoaderCircle, LuRepeat2 } from "react-icons/lu";
import {
  NativeCard,
  NativeGlyph,
  NativeList,
  NativeRow,
  NativeSection,
  SectionAction,
} from "@/shared/components";
import type { WorkoutCalendarDayModel } from "@/types";
import { formatMonthDuration, formatSelectedDayLabel, type CalendarCell } from "../utils/calendar";

type CalendarDayDetailProps = {
  selectedCell: CalendarCell | null;
  workouts: WorkoutCalendarDayModel[];
  isReusing: boolean;
  onReuse: (workout: WorkoutCalendarDayModel) => void;
};

function formatWorkoutMeta(workout: WorkoutCalendarDayModel): string {
  const parts = [
    formatMonthDuration(workout.durationSeconds),
    `${workout.exerciseCount} exercise${workout.exerciseCount === 1 ? "" : "s"}`,
    `${workout.setCount} set${workout.setCount === 1 ? "" : "s"}`,
  ];

  if (workout.totalVolumeKg != null) {
    parts.push(`${Math.round(workout.totalVolumeKg).toLocaleString()} kg`);
  }

  return parts.join(" · ");
}

export function CalendarDayDetail({
  selectedCell,
  workouts,
  isReusing,
  onReuse,
}: CalendarDayDetailProps) {
  const navigate = useNavigate();

  if (!selectedCell) {
    return null;
  }

  const lastWorkout = workouts.at(-1) ?? null;

  return (
    <NativeSection
      title={formatSelectedDayLabel(selectedCell.date)}
      action={
        lastWorkout ? (
          <SectionAction onClick={() => onReuse(lastWorkout)}>
            {isReusing ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuRepeat2 className="h-4 w-4" />
            )}
            Repeat
          </SectionAction>
        ) : undefined
      }
    >
      {workouts.length === 0 ? (
        <NativeCard>
          <p className="cal-empty">
            {selectedCell.isToday ? "Nothing logged today yet." : "Rest day — nothing logged."}
          </p>
        </NativeCard>
      ) : (
        <NativeList>
          {workouts.map((workout) => (
            <NativeRow
              key={workout.workoutId}
              glyph={
                <NativeGlyph tint="orange">
                  <LuDumbbell className="h-5 w-5" />
                </NativeGlyph>
              }
              title={workout.title}
              subtitle={formatWorkoutMeta(workout)}
              onClick={() => navigate(`/workouts/${workout.workoutId}/summary`)}
            />
          ))}
        </NativeList>
      )}
    </NativeSection>
  );
}
