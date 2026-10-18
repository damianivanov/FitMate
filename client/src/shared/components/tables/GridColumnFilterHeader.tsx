import { useId, useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import { Popover } from "@mui/material";
import { gridSortModelSelector, useGridApiContext, useGridSelector } from "@mui/x-data-grid";
import { LuArrowDown, LuArrowUp, LuListFilter, LuSearch } from "react-icons/lu";
import type { GridFilterOptionModel } from "@/types";

type Props = {
  field: string;
  title: string;
  children: ReactNode;
  options: GridFilterOptionModel[];
  optionImages?: ReadonlyMap<string, string>;
  selected: string[];
  sortable: boolean;
  onChange: (field: string, values: string[]) => void;
};

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function handleDialogKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    event.stopPropagation();
  }
}

function FilterOption({ option, imageUrl, checked, onToggle }: {
  option: GridFilterOptionModel;
  imageUrl?: string;
  checked: boolean;
  onToggle: (value: string) => void;
}) {
  function handleChange() {
    onToggle(option.value);
  }

  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-primary-200">
      <input type="checkbox" checked={checked} onChange={handleChange} className="h-4 w-4 shrink-0 accent-primary" />
      {imageUrl && (
        <img src={imageUrl} alt="" aria-hidden loading="lazy" className="h-7 w-7 shrink-0 rounded-md object-contain" />
      )}
      <span className="min-w-0 truncate text-sm" title={option.label}>{option.label}</span>
    </label>
  );
}

export function GridColumnFilterHeader({ field, title, children, options, optionImages, selected, sortable, onChange }: Props) {
  const id = useId();
  const apiRef = useGridApiContext();
  const sortModel = useGridSelector(apiRef, gridSortModelSelector);
  const sortDirection = sortModel.find((item) => item.field === field)?.sort;
  const sortAction = sortDirection === "asc" ? "Sort descending"
    : sortDirection === "desc" ? "Clear sorting" : "Sort ascending";
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const visibleOptions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? options.filter((option) => option.label.toLocaleLowerCase().includes(term)) : options;
  }, [options, search]);
  const selectedValues = useMemo(() => new Set(selected), [selected]);

  function handleOpen(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setAnchor(event.currentTarget);
  }

  function handleClose() {
    setAnchor(null);
    setSearch("");
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
  }

  function handleToggle(value: string) {
    onChange(field, selectedValues.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function handleClear() {
    onChange(field, []);
    if (sortDirection) {
      apiRef.current.sortColumn(field, null);
    }
  }

  function handleSortCycle() {
    const nextDirection = sortDirection === "asc" ? "desc"
      : sortDirection === "desc" ? null : "asc";
    apiRef.current.sortColumn(field, nextDirection);
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-1 py-1 pr-1">
      <div className="min-w-0 flex-1 truncate">{children}</div>
      <button
        type="button"
        onClick={handleOpen}
        onMouseDown={stopPropagation}
        onKeyDown={stopPropagation}
        aria-label={`Filter ${title}${selected.length ? ` (${selected.length} selected)` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-controls={anchor ? id : undefined}
        className={`relative inline-flex h-8 w-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 ${selected.length || sortDirection ? "bg-primary-200 text-primary" : "text-secondary hover:text-primary"}`}
      >
        <LuListFilter className="h-4 w-4 shrink-0" />
        {selected.length > 0 && (
          <span aria-hidden className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold leading-none text-white">
            {selected.length}
          </span>
        )}
      </button>
      <Popover
        id={id}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 2.2, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <div
          role="dialog"
          aria-label={`Filter ${title}`}
          className="flex w-72 flex-col p-3 text-foreground sm:w-80"
          style={{ maxHeight: "calc(100dvh - 32px)" }}
          onClick={stopPropagation}
          onKeyDown={handleDialogKeyDown}
        >
          {(options.length > 10 || sortable) && (
            <div className="mb-3 flex shrink-0 items-center gap-2">
              {options.length > 10 && (
                <div className="liquid-input flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3">
                  <LuSearch className="h-4 w-4 shrink-0 text-secondary" />
                  <input autoFocus value={search} onChange={handleSearchChange} aria-label={`Search ${title} options`} placeholder="Search options" className="w-full min-w-0 bg-transparent text-sm outline-none" />
                </div>
              )}
              {sortable && (
                <button
                  type="button"
                  onClick={handleSortCycle}
                  aria-label={`${sortAction}: ${title}`}
                  aria-pressed={!!sortDirection}
                  title={sortAction}
                  className={`ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${sortDirection ? "text-primary" : "text-secondary hover:text-primary"}`}
                >
                  <LuArrowUp aria-hidden className={`h-4 w-4 ${sortDirection === "desc" ? "opacity-40" : ""}`} />
                  <LuArrowDown aria-hidden className={`h-4 w-4 ${sortDirection === "asc" ? "opacity-40" : ""}`} />
                </button>
              )}
            </div>
          )}
          <p className="mb-2 shrink-0 text-xs text-secondary">{selected.length ? `${selected.length} selected` : "All values"}</p>
          <div className="max-h-72 min-h-0 overflow-y-auto overscroll-contain">
            {visibleOptions.map((option) => (
              <FilterOption
                key={option.value}
                option={option}
                imageUrl={optionImages?.get(option.label)}
                checked={selectedValues.has(option.value)}
                onToggle={handleToggle}
              />
            ))}
            {!visibleOptions.length && <p className="px-2 py-4 text-sm text-secondary">No matching values</p>}
          </div>
          <div className="mt-3 shrink-0 border-t border-border pt-3">
            <button
              type="button"
              onClick={handleClear}
              disabled={!selected.length && !sortDirection}
              className={`liquid-pill h-11 w-full cursor-pointer rounded-full text-sm font-semibold text-primary disabled:cursor-default disabled:opacity-40 ${selected.length ? "liquid-pill-primary" : ""}`}
            >
              Clear
            </button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
