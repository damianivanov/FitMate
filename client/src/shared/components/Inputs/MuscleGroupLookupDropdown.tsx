import { useMemo } from "react";
import type { MuscleGroup } from "@/types";
import { LookupDropdown } from "./LookupDropdown";
import type { LookupDropdownOption, LookupDropdownProps } from "./LookupDropdown";

type MuscleGroupLookupDropdownProps = Omit<LookupDropdownProps, "options"> & {
  muscleGroups: MuscleGroup[];
  leadingOptions?: readonly LookupDropdownOption[];
};

export function MuscleGroupLookupDropdown({
  muscleGroups,
  leadingOptions = [],
  ...dropdownProps
}: MuscleGroupLookupDropdownProps) {
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

  return <LookupDropdown {...dropdownProps} options={options} />;
}
