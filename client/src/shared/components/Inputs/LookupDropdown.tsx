import { FloatingDropdown } from "./FloatingDropdown";
import type { FloatingDropdownOption, FloatingDropdownProps } from "./FloatingDropdown";

export type LookupDropdownOption = FloatingDropdownOption;

export type LookupDropdownProps = Omit<FloatingDropdownProps, "hideScrollbar">;

export function LookupDropdown(props: LookupDropdownProps) {
  return <FloatingDropdown {...props} hideScrollbar />;
}
