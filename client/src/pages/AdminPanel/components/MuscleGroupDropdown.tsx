import { useMemo } from "react";
import { Dropdown } from "@/shared/components";
import type { DropdownOption, DropdownProps } from "@/shared/components";
import type { MuscleGroup } from "@/types";

type SingleDropdownProps = Extract<DropdownProps<string>, { multiple?: false }>;

type MuscleGroupDropdownProps = Omit<SingleDropdownProps, "options"> & {
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
