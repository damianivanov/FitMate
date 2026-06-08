import { useMemo } from "react";
import type { MuscleGroup } from "@/types";
import { Dropdown } from "./Dropdown";
import type { DropdownOption, DropdownSingleControlProps } from "./Dropdown";

type MuscleGroupDropdownProps = DropdownSingleControlProps<string> & {
  muscleGroups: MuscleGroup[];
  leadingOptions?: readonly DropdownOption<string>[];
};

export function MuscleGroupDropdown({
  muscleGroups,
  leadingOptions = [],
  ...dropdownProps
}: MuscleGroupDropdownProps) {
  const options = useMemo(
    () => [
      ...leadingOptions,
      ...muscleGroups.map((group) => ({
        value: String(group.id),
        label: group.name,
        imageUrl: group.imageUrl ?? undefined,
      })),
    ],
    [leadingOptions, muscleGroups],
  );

  return <Dropdown {...dropdownProps} options={options} />;
}
