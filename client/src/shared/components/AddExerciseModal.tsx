import { useEffect, useMemo, useState, type ComponentProps } from "react";
import type { MuscleGroup } from "@/types";
import { Modal } from "./Modal";
import {
  ImageFileInput,
  MuscleGroupDropdown,
  SegmentControl,
  TextInputField,
  TextareaField,
} from "./Inputs";
import { SegmentControlSize } from "./Inputs/SegmentControlSize";
import type { ExerciseFormValues } from "./exerciseFormValues";

const visibilityOptions = [
  { label: "Public", value: true },
  { label: "Private", value: false },
] as const;

type AddExerciseModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  mode: "create" | "edit";
  values: ExerciseFormValues;
  muscleGroups: MuscleGroup[];
  error: string | null;
  maxWidth?: ComponentProps<typeof Modal>["maxWidth"];
  showVisibilityToggle?: boolean;
  onClose: () => void;
  onSubmit: (values: ExerciseFormValues, file?: File) => Promise<void> | void;
};

export function AddExerciseModal({
  isOpen,
  isSaving,
  mode,
  values,
  muscleGroups,
  error,
  maxWidth = "2xl",
  showVisibilityToggle = false,
  onClose,
  onSubmit,
}: AddExerciseModalProps) {
  const isEditing = mode === "edit";

  const [name, setName] = useState(values.name);
  const [description, setDescription] = useState(values.description);
  const [primaryMuscleGroupId, setPrimaryMuscleGroupId] = useState(values.primaryMuscleGroupId);
  const [secondaryMuscleGroupId, setSecondaryMuscleGroupId] = useState(values.secondaryMuscleGroupId);
  const [isPublic, setIsPublic] = useState(values.isPublic);
  const [file, setFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSave = () => {
    onSubmit(
      { ...values, name, description, primaryMuscleGroupId, secondaryMuscleGroupId, isPublic },
      file ?? undefined,
    );
  };

  const fieldContainerClassName = "space-y-1.5 text-sm font-medium text-foreground";
  const dropdownContainerClassName = "space-y-1.5 text-sm font-medium";
  const labelClassName = "block pb-1.5 text-xs font-semibold uppercase tracking-widest text-primary";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Exercise" : "Create Exercise"}
      maxWidth={maxWidth}
    >
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6">
        <TextInputField
          id="exercise-name"
          label="Name"
          containerClassName={`${fieldContainerClassName}${
            !showVisibilityToggle && mode === "create" ? " md:col-span-2" : ""
          }`}
          labelClassName={labelClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {showVisibilityToggle && (
          <div className={fieldContainerClassName}>
            <p className={labelClassName}>Visibility</p>
            <SegmentControl<boolean>
              id="exercise-visibility"
              value={isPublic}
              onChange={setIsPublic}
              options={visibilityOptions}
              size={SegmentControlSize.Md}
              className="w-full"
            />
          </div>
        )}

        <MuscleGroupDropdown
          id="exercise-primary-muscle-group"
          label="Primary Muscle Group"
          value={primaryMuscleGroupId}
          onChange={(value) => setPrimaryMuscleGroupId(value ?? "")}
          muscleGroups={muscleGroups}
          containerClassName={dropdownContainerClassName}
          labelClassName={labelClassName}
          placeholder="Select muscle group"
          required
        />

        <MuscleGroupDropdown
          id="exercise-secondary-muscle-group"
          label="Secondary Muscle Group"
          value={secondaryMuscleGroupId}
          onChange={(value) => setSecondaryMuscleGroupId(value ?? "")}
          muscleGroups={muscleGroups}
          leadingOptions={[{ value: "", label: "None" }]}
          containerClassName={dropdownContainerClassName}
          labelClassName={labelClassName}
          placeholder="None"
        />

        {mode === "create" && (
          <div className={`${fieldContainerClassName} md:col-span-2`}>
            <label htmlFor="exercise-image-file" className={labelClassName}>
              Image
            </label>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Exercise image preview"
                className="mb-2 h-24 w-24 rounded-md object-cover"
              />
            )}
            <ImageFileInput
              id="exercise-image-file"
              fileName={file?.name ?? null}
              onChange={setFile}
            />
          </div>
        )}

        <TextareaField
          id="exercise-description"
          label="Description"
          containerClassName={`${fieldContainerClassName} md:col-span-2`}
          labelClassName={labelClassName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}

        <div className="flex w-full items-center justify-between gap-3 md:col-span-2">
          <button
            type="button"
            className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : isEditing ? "Update Exercise" : "Create Exercise"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
