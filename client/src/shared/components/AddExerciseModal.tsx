import { useEffect, useMemo, useState, type ComponentProps, type KeyboardEvent } from "react";
import { LuX } from "react-icons/lu";
import {
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseLoadBasis,
  ExerciseMovementPattern,
} from "@/types";
import type { MuscleGroup } from "@/types";
import { Modal } from "./Modal";
import {
  Dropdown,
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

/** Turns a numeric TS enum object into dropdown options with spaced labels ("HorizontalPush" → "Horizontal Push"). */
function toEnumOptions(source: Record<string, string | number>): { label: string; value: string }[] {
  return Object.entries(source)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([name, value]) => ({
      label: name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      value: String(value),
    }));
}

const equipmentOptions = toEnumOptions(ExerciseEquipment);
const movementPatternOptions = toEnumOptions(ExerciseMovementPattern);
const difficultyOptions = toEnumOptions(ExerciseDifficulty);
const categoryOptions = toEnumOptions(ExerciseCategory);
const loadBasisOptions = toEnumOptions(ExerciseLoadBasis);

type AddExerciseModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  mode: "create" | "edit";
  values: ExerciseFormValues;
  muscleGroups: MuscleGroup[];
  error: string | null;
  maxWidth?: ComponentProps<typeof Modal>["maxWidth"];
  showVisibilityToggle?: boolean;
  showMetadataFields?: boolean;
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
  showMetadataFields = false,
  onClose,
  onSubmit,
}: AddExerciseModalProps) {
  const isEditing = mode === "edit";

  const [name, setName] = useState(values.name);
  const [description, setDescription] = useState(values.description);
  const [primaryMuscleGroupId, setPrimaryMuscleGroupId] = useState(values.primaryMuscleGroupId);
  const [secondaryMuscleGroupId, setSecondaryMuscleGroupId] = useState(values.secondaryMuscleGroupId);
  const [isPublic, setIsPublic] = useState(values.isPublic);
  const [equipment, setEquipment] = useState(values.equipment);
  const [movementPattern, setMovementPattern] = useState(values.movementPattern);
  const [difficulty, setDifficulty] = useState(values.difficulty);
  const [category, setCategory] = useState(values.category);
  const [loadBasis, setLoadBasis] = useState(values.loadBasis);
  const [aliases, setAliases] = useState<string[]>(values.aliases);
  const [aliasDraft, setAliasDraft] = useState("");
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
      {
        ...values,
        name,
        description,
        primaryMuscleGroupId,
        secondaryMuscleGroupId,
        isPublic,
        equipment,
        movementPattern,
        difficulty,
        category,
        loadBasis,
        aliases,
      },
      file ?? undefined,
    );
  };

  const commitAliasDraft = () => {
    const alias = aliasDraft.trim().replace(/,+$/, "");
    if (alias && !aliases.includes(alias)) {
      setAliases((current) => [...current, alias]);
    }
    setAliasDraft("");
  };

  const handleAliasKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== ",") {
      return;
    }
    event.preventDefault();
    commitAliasDraft();
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

        {showMetadataFields && (
          <>
            <Dropdown
              id="exercise-equipment"
              label="Equipment"
              value={equipment || null}
              onChange={(value) => setEquipment(value ?? "")}
              options={equipmentOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-movement-pattern"
              label="Movement Pattern"
              value={movementPattern || null}
              onChange={(value) => setMovementPattern(value ?? "")}
              options={movementPatternOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-difficulty"
              label="Difficulty"
              value={difficulty || null}
              onChange={(value) => setDifficulty(value ?? "")}
              options={difficultyOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-category"
              label="Category"
              value={category || null}
              onChange={(value) => setCategory(value ?? "")}
              options={categoryOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-load-basis"
              label="Logged Weight"
              value={loadBasis || null}
              onChange={(value) => setLoadBasis(value ?? "")}
              options={loadBasisOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <div className={`${fieldContainerClassName} md:col-span-2`}>
              <label htmlFor="exercise-aliases" className={labelClassName}>
                Aliases
              </label>
              {aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {aliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      aria-label={`Remove alias ${alias}`}
                      className="liquid-pill inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      onClick={() => setAliases((current) => current.filter((a) => a !== alias))}
                    >
                      {alias}
                      <LuX className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <input
                id="exercise-aliases"
                value={aliasDraft}
                onChange={(event) => setAliasDraft(event.target.value)}
                onBlur={commitAliasDraft}
                onKeyDown={handleAliasKeyDown}
                className="liquid-input w-full rounded-full px-3 py-2.5"
                placeholder="Type an alias and press Enter (e.g. Military Press)"
              />
            </div>
          </>
        )}

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
