import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { LuCheck, LuChevronDown, LuSearch, LuX } from "react-icons/lu";
import { FormField } from "./FormField";

export type DropdownOption<TValue extends string | number = string> = {
  label: string;
  value: TValue;
  disabled?: boolean;
  keywords?: string[];
  imageUrl?: string;
};

type DropdownBaseProps<TValue extends string | number> = {
  id?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  options: readonly DropdownOption<TValue>[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  className?: string;
  menuClassName?: string;
  optionClassName?: string;
  selectedCheckIconClassName?: string;
  optionsContainerClassName?: string;
  clearable?: boolean;
  closeOnSelect?: boolean;
  hideScrollbar?: boolean;
  renderOption?: (
    option: DropdownOption<TValue>,
    state: { selected: boolean; highlighted: boolean },
  ) => ReactNode;
  onSearchChange?: (query: string) => void;
  onBlur?: () => void;
};

type DropdownSingleProps<TValue extends string | number> = DropdownBaseProps<TValue> & {
  multiple?: false;
  value: TValue | null;
  onChange: (value: TValue | null, option: DropdownOption<TValue> | null) => void;
};

type DropdownMultiProps<TValue extends string | number> = DropdownBaseProps<TValue> & {
  multiple: true;
  value: TValue[];
  onChange: (value: TValue[], options: DropdownOption<TValue>[]) => void;
};

export type DropdownProps<TValue extends string | number = string> =
  | DropdownSingleProps<TValue>
  | DropdownMultiProps<TValue>;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function findFirstEnabledIndex<TValue extends string | number>(
  options: readonly DropdownOption<TValue>[],
): number {
  return options.findIndex((option) => !option.disabled);
}

function findNextEnabledIndex<TValue extends string | number>(
  options: readonly DropdownOption<TValue>[],
  startIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) {
    return -1;
  }

  let nextIndex = startIndex;
  for (let step = 0; step < options.length; step += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length;
    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

const VIEWPORT_PADDING_PX = 12;
const MENU_OFFSET_PX = 8;
const MENU_MAX_HEIGHT_PX = 320;
const MENU_MIN_HEIGHT_PX = 120;
const SEARCH_SECTION_HEIGHT_PX = 64;

export function Dropdown<TValue extends string | number>(props: DropdownProps<TValue>) {
  const {
    id,
    label,
    required = false,
    error,
    helperText,
    containerClassName,
    labelClassName,
    options,
    placeholder = "Select...",
    searchable = false,
    searchPlaceholder = "Search...",
    disabled = false,
    loading = false,
    emptyText = "No options found",
    className,
    menuClassName,
    optionClassName,
    selectedCheckIconClassName,
    optionsContainerClassName,
    clearable = false,
    closeOnSelect = !props.multiple,
    hideScrollbar = false,
    renderOption,
    onSearchChange,
    onBlur,
  } = props;

  const isMulti = props.multiple === true;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPlacement, setMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = useState(MENU_MAX_HEIGHT_PX);

  const selectedValues = useMemo<TValue[]>(() => {
    if (isMulti) {
      return props.value;
    }

    return props.value === null ? [] : [props.value];
  }, [isMulti, props.value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchHaystack = [
        option.label,
        String(option.value),
        ...(option.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchHaystack.includes(normalizedQuery);
    });
  }, [options, search]);

  const selectedOptions = useMemo(() => {
    if (!selectedValues.length) {
      return [];
    }

    const valueSet = new Set(selectedValues);
    return options.filter((option) => valueSet.has(option.value));
  }, [options, selectedValues]);

  const hasValue = selectedValues.length > 0;

  const displayValue = useMemo(() => {
    if (!selectedOptions.length) {
      return placeholder;
    }

    if (isMulti) {
      return selectedOptions.map((option) => option.label).join(", ");
    }

    return selectedOptions[0]?.label ?? placeholder;
  }, [isMulti, placeholder, selectedOptions]);

  const closeMenu = useCallback(() => {
    if (!open) {
      return;
    }

    setOpen(false);
    onBlur?.();
  }, [onBlur, open]);

  const updateMenuLayout = useCallback(() => {
    if (!rootRef.current) {
      return;
    }

    const rootRect = rootRef.current.getBoundingClientRect();
    const availableBelow = window.innerHeight - rootRect.bottom - VIEWPORT_PADDING_PX - MENU_OFFSET_PX;
    const availableAbove = rootRect.top - VIEWPORT_PADDING_PX - MENU_OFFSET_PX;
    const shouldOpenAbove = availableBelow < 220 && availableAbove > availableBelow;
    const availableSpace = shouldOpenAbove ? availableAbove : availableBelow;
    const resolvedMenuMaxHeight = Math.max(
      MENU_MIN_HEIGHT_PX,
      Math.min(MENU_MAX_HEIGHT_PX, availableSpace),
    );

    setMenuPlacement(shouldOpenAbove ? "top" : "bottom");
    setMenuMaxHeight(resolvedMenuMaxHeight);
  }, []);

  useEffect(() => {
    onSearchChange?.(search);
  }, [onSearchChange, search]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (open && searchable) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setHighlightedIndex(findFirstEnabledIndex(filteredOptions));
  }, [filteredOptions, open, search]);

  useEffect(() => {
    if (!open || !disabled) {
      return;
    }

    closeMenu();
  }, [closeMenu, disabled, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuLayout();

    const handleViewportChange = () => {
      updateMenuLayout();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuLayout]);

  const isSelected = useCallback(
    (value: TValue) => selectedValues.includes(value),
    [selectedValues],
  );

  const emitSingleChange = useCallback(
    (value: TValue | null) => {
      if (isMulti) {
        return;
      }

      const selectedOption = options.find((option) => option.value === value) ?? null;
      props.onChange(value, selectedOption);
    },
    [isMulti, options, props],
  );

  const emitMultiChange = useCallback(
    (values: TValue[]) => {
      if (!isMulti) {
        return;
      }

      const selected = options.filter((option) => values.includes(option.value));
      props.onChange(values, selected);
    },
    [isMulti, options, props],
  );

  const toggleOption = useCallback(
    (option: DropdownOption<TValue>) => {
      if (option.disabled) {
        return;
      }

      if (isMulti) {
        const exists = props.value.includes(option.value);
        const nextValues = exists
          ? props.value.filter((value) => value !== option.value)
          : [...props.value, option.value];

        emitMultiChange(nextValues);
        if (closeOnSelect) {
          closeMenu();
        }
        return;
      }

      emitSingleChange(option.value);
      if (closeOnSelect) {
        closeMenu();
      }
    },
    [closeMenu, closeOnSelect, emitMultiChange, emitSingleChange, isMulti, props.value],
  );

  const handleClearSelectionClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (isMulti) {
        emitMultiChange([]);
        return;
      }

      emitSingleChange(null);
    },
    [emitMultiChange, emitSingleChange, isMulti],
  );

  const moveHighlight = useCallback(
    (direction: 1 | -1) => {
      if (!filteredOptions.length) {
        return;
      }

      const baseIndex = highlightedIndex >= 0 ? highlightedIndex : 0;
      const nextIndex = findNextEnabledIndex(filteredOptions, baseIndex, direction);
      if (nextIndex >= 0) {
        setHighlightedIndex(nextIndex);
      }
    },
    [filteredOptions, highlightedIndex],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }

        moveHighlight(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }

        moveHighlight(-1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }

        const highlightedOption = filteredOptions[highlightedIndex];
        if (highlightedOption) {
          toggleOption(highlightedOption);
        }
        return;
      }

      if (event.key === "Escape") {
        closeMenu();
      }
    },
    [closeMenu, disabled, filteredOptions, highlightedIndex, moveHighlight, open, toggleOption],
  );

  const handleTriggerClick = useCallback(() => {
    if (disabled) {
      return;
    }

    setOpen((previous) => !previous);
  }, [disabled]);

  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    [],
  );

  const optionsListClassName = cn(
    "overflow-y-auto overflow-x-hidden p-1.5",
    hideScrollbar ? "liquid-scrollbar-hidden" : "liquid-scrollbar",
    optionsContainerClassName,
  );
  const menuPositionClassName = menuPlacement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  const menuAnimationClassName =
    menuPlacement === "top"
      ? "origin-bottom lookup-dropdown-menu-enter-up"
      : "origin-top lookup-dropdown-menu-enter-down";
  const listMaxHeight = searchable
    ? Math.max(80, menuMaxHeight - SEARCH_SECTION_HEIGHT_PX)
    : menuMaxHeight;

  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      containerClassName={containerClassName}
      labelClassName={labelClassName}
    >
      <div ref={rootRef} className={cn("relative w-full", className)} onKeyDown={handleKeyDown}>
        <div
          id={id}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={handleTriggerClick}
          className={cn(
            "liquid-input flex w-full cursor-pointer! items-center justify-between gap-2 rounded-full px-4 py-3 text-left text-sm outline-none transition",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <span className={cn("truncate text-left", hasValue ? "text-foreground" : "text-secondary")}>
            {displayValue}
          </span>

          <span className="flex shrink-0 items-center gap-1">
            {clearable && hasValue && !disabled ? (
              <button
                type="button"
                onClick={handleClearSelectionClick}
                aria-label="Clear selection"
                className="relative rounded-full p-0.5 text-danger transition-colors hover:bg-(--color-danger-soft)"
              >
                <LuX className="h-4 w-4" />
              </button>
            ) : null}
            <LuChevronDown className={cn("h-5 w-5 text-secondary transition-transform", open && "rotate-180")} />
          </span>
        </div>

        {open ? (
          <div
            className={cn(
              "liquid-panel liquid-floating-surface absolute z-50 w-full overflow-hidden rounded-2xl p-1",
              menuPositionClassName,
              menuAnimationClassName,
              menuClassName,
            )}
            style={{ maxHeight: menuMaxHeight }}
          >
            {searchable ? (
              <div className="liquid-divider mb-1 border-b pb-1">
                <div className="liquid-input flex h-10 items-center gap-2 rounded-xl px-3 my-1">
                  <LuSearch className="h-4 w-4 shrink-0 text-secondary" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={handleSearchInputChange}
                    placeholder={searchPlaceholder}
                    className={cn(
                      "w-full bg-transparent text-sm text-foreground outline-none",
                      "placeholder:text-white/70",
                    )}
                  />
                </div>
              </div>
            ) : null}

            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable={isMulti || undefined}
              className={optionsListClassName}
              style={{ maxHeight: listMaxHeight }}
            >
              {loading ? (
                <li className="px-4 py-2.5 text-sm text-secondary">Loading...</li>
              ) : filteredOptions.length === 0 ? (
                <li className="px-4 py-2.5 text-sm text-secondary">{emptyText}</li>
              ) : (
                filteredOptions.map((option, index) => {
                  const selected = isSelected(option.value);
                  const highlighted = index === highlightedIndex;

                  return (
                    <li key={String(option.value)} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        disabled={option.disabled}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => toggleOption(option)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-full px-4 py-2.5 text-left text-sm transition",
                          selected && "liquid-option-selected lookup-dropdown-option-selected font-semibold",
                          !selected && !option.disabled && "liquid-option",
                          !option.disabled && "cursor-pointer",
                          highlighted && !selected && !option.disabled && "bg-(--option-hover-bg)",
                          option.disabled && "liquid-option-disabled cursor-not-allowed",
                          optionClassName,
                        )}
                      >
                        {renderOption ? (
                          renderOption(option, { selected, highlighted })
                        ) : (
                          <span className="flex min-w-0 items-center gap-2">
                            {option.imageUrl ? (
                              <img
                                src={option.imageUrl}
                                alt=""
                                aria-hidden="true"
                                className="h-6 w-6 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <span className="truncate">{option.label}</span>
                          </span>
                        )}

                        {selected ? (
                          <LuCheck
                            className={cn(
                              "lookup-dropdown-check-enter h-4 w-4 shrink-0 text-current",
                              selectedCheckIconClassName,
                            )}
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
