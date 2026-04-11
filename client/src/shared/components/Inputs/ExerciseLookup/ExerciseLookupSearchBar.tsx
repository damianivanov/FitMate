import type { ChangeEvent } from "react";
import { LuSearch } from "react-icons/lu";

type ExerciseLookupSearchBarProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  hasQuery: boolean;
  resultCount: number;
  onChange: (nextValue: string) => void;
};

export function ExerciseLookupSearchBar({
  id,
  label,
  value,
  placeholder,
  hasQuery,
  resultCount,
  onChange,
}: ExerciseLookupSearchBarProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-secondary">
        {label}
      </label>
      <div className="liquid-input flex w-full items-center gap-2 rounded-full px-4 py-3">
        <LuSearch className="h-4 w-4 shrink-0 text-tertiary" />
        <input
          id={id}
          value={value}
          onChange={handleSearchChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-tertiary"
        />
        {hasQuery ? (
          <span className="liquid-primary-chip rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {resultCount} results
          </span>
        ) : null}
      </div>
    </div>
  );
}
