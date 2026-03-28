import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { OutlinedButton, PrimaryButton } from "@/shared/components/Buttons";
import type { Exercise, Mood, WorkoutTemplate } from "@/types/workout";

type CreateWorkoutForm = {
  title: string;
  templateId: string;
  bodyWeightKg: string;
  mood: Mood;
  notes: string;
};

type CreateWorkoutPayload = {
  title: string;
  templateId: number | null;
  bodyWeightKg: number | null;
  mood: Mood;
  notes: string;
};

type CreateWorkoutModalProps = {
  open: boolean;
  onClose: () => void;
  onStart: (data: CreateWorkoutPayload) => void;
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  lastBodyWeight?: number;
};

const MOODS: Mood[] = ["energized", "neutral", "tired", "stressed"];

function getTemplatePreviewRowClassName(index: number): string {
  const baseClassName = "flex items-center gap-2 py-1.5 text-sm text-secondary";
  const stateClassName = index > 0 ? "liquid-divider border-t" : "";

  return `${baseClassName} ${stateClassName}`.trim();
}

export default function CreateWorkoutModal({
  open,
  onClose,
  onStart,
  templates,
  exercises,
  lastBodyWeight,
}: CreateWorkoutModalProps) {
  const [form, setForm] = useState<CreateWorkoutForm>({
    title: "",
    templateId: "",
    bodyWeightKg: lastBodyWeight?.toString() ?? "",
    mood: "neutral",
    notes: "",
  });

  const update = <K extends keyof CreateWorkoutForm>(key: K, value: CreateWorkoutForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === Number(form.templateId)),
    [templates, form.templateId],
  );

  const getExerciseName = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Unknown";

  const handleTemplateChange = (value: string) => {
    update("templateId", value);
    if (value && !form.title) {
      const tmpl = templates.find((t) => t.id === Number(value));
      if (tmpl) update("title", tmpl.name);
    }
  };

  const handleStart = () => {
    onStart({
      title: form.title || "Workout",
      templateId: form.templateId ? Number(form.templateId) : null,
      bodyWeightKg: form.bodyWeightKg ? Number(form.bodyWeightKg) : null,
      mood: form.mood,
      notes: form.notes,
    });
    setForm({ title: "", templateId: "", bodyWeightKg: lastBodyWeight?.toString() ?? "", mood: "neutral", notes: "" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start New Workout"
      size="md"
      footer={
        <>
          <OutlinedButton type="button" onClick={onClose}>
            Cancel
          </OutlinedButton>
          <PrimaryButton type="button" onClick={handleStart}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
            Start Workout
          </PrimaryButton>
        </>
      }
    >
      {/* Title */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tertiary">
          Workout Title
        </label>
        <input
          type="text"
          placeholder="e.g. Push Day A, Morning Session..."
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          autoFocus
          className="liquid-input w-full rounded-xl px-5 py-3 text-sm"
        />
      </div>

      {/* Template */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tertiary">
          Based on Template
        </label>
        <select
          value={form.templateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="liquid-input w-full appearance-none rounded-xl px-5 py-3 text-sm"
        >
          <option value="">Empty workout — start from scratch</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Template preview */}
      {selectedTemplate && (
        <div className="liquid-info-surface mb-5 rounded-xl px-4 py-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
            Template Preview
          </div>
          {selectedTemplate.groups.map((g, i) => (
            <div
              key={g.id}
              className={getTemplatePreviewRowClassName(i)}
            >
              <span className="min-w-4.5 font-mono text-xs text-muted">{i + 1}</span>
              {g.groupType !== "straight" && (
                <span className="liquid-chip liquid-chip-info rounded-full px-2 py-0.5 text-xs font-bold uppercase">
                  {g.groupType}
                </span>
              )}
              <span className="flex-1 truncate">
                {g.exercises.map((e) => getExerciseName(e.exerciseId)).join(" + ")}
              </span>
              <span className="font-mono text-xs text-muted">
                {g.exercises[0]?.targetSets}×{g.exercises[0]?.targetReps}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Body weight + Mood row */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tertiary">
            Body Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="84.2"
            value={form.bodyWeightKg}
            onChange={(e) => update("bodyWeightKg", e.target.value)}
            className="liquid-input w-full rounded-xl px-5 py-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tertiary">
            Mood
          </label>
          <select
            value={form.mood}
            onChange={(e) => update("mood", e.target.value as Mood)}
            className="liquid-input w-full appearance-none rounded-xl px-5 py-3 text-sm capitalize"
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tertiary">
          Notes
        </label>
        <textarea
          placeholder="Pre-workout notes..."
          rows={2}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="liquid-input w-full rounded-xl px-5 py-3 text-sm"
        />
      </div>
    </Modal>
  );
}
