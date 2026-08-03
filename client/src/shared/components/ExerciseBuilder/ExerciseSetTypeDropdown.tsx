import { LuChevronDown } from "react-icons/lu";
import { ExerciseSetType } from "@/types";
import { ActionMenu, type ActionMenuItem } from "../ActionMenu";

type SetTypeOption = {
  value: ExerciseSetType;
  label: string;
};

type ExerciseSetTypeDropdownProps = {
  value: ExerciseSetType;
  setNumber: number;
  onChange: (value: ExerciseSetType) => void;
};

const SET_TYPE_OPTIONS: ReadonlyArray<SetTypeOption> = [
  { value: ExerciseSetType.Warmup, label: "Warmup" },
  { value: ExerciseSetType.Working, label: "Work" },
  { value: ExerciseSetType.Dropset, label: "Drop" },
  { value: ExerciseSetType.Failure, label: "Fail" },
];

const TRIGGER_CLASS_NAME =
  "liquid-input relative inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-extrabold text-foreground transition before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] sm:gap-2 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm";

function getSetTypeOption(value: ExerciseSetType): SetTypeOption {
  return SET_TYPE_OPTIONS.find((option) => option.value === value) ?? SET_TYPE_OPTIONS[1];
}

export function ExerciseSetTypeDropdown({
  value,
  setNumber,
  onChange,
}: ExerciseSetTypeDropdownProps) {
  const selectedOption = getSetTypeOption(value);

  const items: ActionMenuItem[] = SET_TYPE_OPTIONS.map((option) => ({
    key: String(option.value),
    label: option.label,
    selected: option.value === value,
    onSelect: () => onChange(option.value),
  }));

  return (
    <ActionMenu
      items={items}
      selectionMode="single"
      placement="bottom-start"
      menuWidthClassName="w-36"
      triggerAriaLabel={`Set type for set ${setNumber}`}
      triggerClassName={TRIGGER_CLASS_NAME}
      triggerOpenClassName="border-primary-600 text-primary ring-2 ring-primary-300"
      triggerContent={
        <>
          <span>{selectedOption.label}</span>
          <LuChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 md:h-4 md:w-4" />
        </>
      }
    />
  );
}
