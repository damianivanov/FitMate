// ─── exercise_set fields from schema ───
export type SetType = "warmup" | "working" | "dropset" | "failure";
export type Side = "both" | "left" | "right";
export type Mood = "energized" | "neutral" | "tired" | "stressed";
export type GroupType = "straight" | "superset" | "circuit";
export type RecordType = "1rm" | "max_weight" | "max_reps" | "max_volume";
export type ForceType = "push" | "pull" | "static";
export type Mechanic = "compound" | "isolation";
export type Difficulty = "beginner" | "intermediate" | "advanced";

// ─── Entities matching schema ───

export type MuscleGroup = {
  id: number;
  name: string;
};

export type Exercise = {
  id: number;
  userId: number | null;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  equipment: string;
  forceType: ForceType;
  mechanic: Mechanic;
  difficulty: Difficulty;
  isUnilateral: boolean;
  primaryMuscleGroupId: number;
  secondaryMuscleGroupId: number | null;
};

export type TemplateExercise = {
  id: number;
  exerciseId: number;
  sortOrderInGroup: number;
  targetSets: number;
  targetReps: string;
  targetWeightKg: number | null;
  targetRestSec: number | null;
  tempo: string | null;
  notes: string | null;
};

export type TemplateExerciseGroup = {
  id: number;
  workoutTemplateId: number;
  sortOrder: number;
  groupType: GroupType;
  restBetweenExercisesSec: number;
  restAfterGroupSec: number;
  rounds: number;
  exercises: TemplateExercise[];
};

export type WorkoutTemplate = {
  id: number;
  userId: number | null;
  name: string;
  description: string;
  estDurationMin: number;
  isPublic: boolean;
  groups: TemplateExerciseGroup[];
};

export type ExerciseSetInput = {
  setNumber: number;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe: string;
  side: Side;
  completed: boolean;
  notes: string;
};

export type WorkoutExerciseInput = {
  exerciseId: number;
  sortOrderInGroup: number;
  notes: string;
  sets: ExerciseSetInput[];
};

export type WorkoutExerciseGroupInput = {
  sortOrder: number;
  groupType: GroupType;
  exercises: WorkoutExerciseInput[];
};

export type ActiveWorkoutState = {
  title: string;
  workoutTemplateId: number | null;
  mood: Mood;
  notes: string;
  groups: WorkoutExerciseGroupInput[];
};

export type WorkoutHistoryItem = {
  id: number;
  workoutTemplateId: number | null;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  totalVolumeKg: number;
  mood: Mood;
  perceivedDifficulty: number;
  notes: string | null;
};

export type PersonalRecord = {
  id: number;
  exerciseId: number;
  recordType: RecordType;
  value: number;
  achievedOn: string;
  isCurrent: boolean;
};

export type UserBodyMetric = {
  id: number;
  recordedOn: string;
  bodyWeightKg: number;
  bodyFatPct: number | null;
  notes: string | null;
};
