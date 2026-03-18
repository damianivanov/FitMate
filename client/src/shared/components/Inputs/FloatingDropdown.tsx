import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown } from "react-icons/lu";

export type FloatingDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
  imageUrl?: string;
};

export type FloatingDropdownProps = {
  id?: string;
  label: string;
  value: string;
  options: readonly FloatingDropdownOption[];
  containerClassName?: string;
  labelClassName?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hideScrollbar?: boolean;
  onChange: (nextValue: string) => void;
  onBlur?: () => void;
};

const VIEWPORT_PADDING_PX = 12;
const MENU_OFFSET_PX = 8;
const MENU_MAX_HEIGHT_PX = 256;
const MENU_MIN_VISIBLE_HEIGHT_PX = 140;

type FloatingDropdownPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

function getTriggerButtonClassName(disabled: boolean): string {
  const baseClassName =
    "liquid-input flex w-full items-center justify-between rounded-full px-3 py-2.5 text-left outline-none transition";
  const stateClassName = disabled ? "cursor-not-allowed! opacity-70" : "cursor-pointer!";

  return `${baseClassName} ${stateClassName}`;
}

function getSelectedValueClassName(hasSelection: boolean): string {
  const baseClassName = "flex min-w-0 items-center gap-2";
  const stateClassName = hasSelection ? "text-slate-900" : "text-slate-500";

  return `${baseClassName} ${stateClassName}`;
}

function getChevronIconClassName(isOpen: boolean): string {
  const baseClassName = "h-4 w-4 text-slate-600 transition-transform";
  const stateClassName = isOpen ? "rotate-180" : "";

  return `${baseClassName} ${stateClassName}`.trim();
}

function getMenuClassName(hideScrollbar: boolean): string {
  const baseClassName =
    "liquid-panel fixed z-[80] overflow-y-auto rounded-2xl p-1";
  const stateClassName = hideScrollbar ? "liquid-scrollbar-hidden" : "liquid-scrollbar";

  return `${baseClassName} ${stateClassName}`;
}

function getOptionClassName(isOptionDisabled: boolean, isSelected: boolean): string {
  const baseClassName = "rounded-full px-3 py-2 text-sm transition";

  if (isOptionDisabled) {
    return `${baseClassName} liquid-option-disabled cursor-not-allowed`;
  }

  if (isSelected) {
    return `${baseClassName} liquid-option-selected font-semibold`;
  }

  return `${baseClassName} liquid-option cursor-pointer`;
}

export function FloatingDropdown({
  id,
  label,
  value,
  options,
  containerClassName = "space-y-3",
  labelClassName = "text-sm font-medium text-slate-700",
  placeholder = "Select",
  required = false,
  disabled = false,
  error,
  hideScrollbar = false,
  onChange,
  onBlur,
}: FloatingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingDropdownPosition | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onBlur?.();
  }, [onBlur]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING_PX;
    const availableAbove = rect.top - VIEWPORT_PADDING_PX;
    const openAbove =
      availableBelow < MENU_MIN_VISIBLE_HEIGHT_PX && availableAbove > availableBelow;

    if (openAbove) {
      setPosition({
        left: rect.left,
        width: rect.width,
        bottom: Math.max(VIEWPORT_PADDING_PX, window.innerHeight - rect.top + MENU_OFFSET_PX),
        maxHeight: Math.max(
          MENU_MIN_VISIBLE_HEIGHT_PX,
          Math.min(MENU_MAX_HEIGHT_PX, availableAbove),
        ),
      });
      return;
    }

    setPosition({
      left: rect.left,
      width: rect.width,
      top: Math.max(VIEWPORT_PADDING_PX, rect.bottom + MENU_OFFSET_PX),
      maxHeight: Math.max(
        MENU_MIN_VISIBLE_HEIGHT_PX,
        Math.min(MENU_MAX_HEIGHT_PX, availableBelow),
      ),
    });
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const eventTarget = event.target as Node;
      if (
        !rootRef.current ||
        rootRef.current.contains(eventTarget) ||
        listRef.current?.contains(eventTarget)
      ) {
        return;
      }

      closeMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      closeMenu();
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const handleViewportChange = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, options.length, updatePosition]);

  const selectValue = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeMenu();
    },
    [closeMenu, onChange],
  );

  const handleTriggerClick = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        updatePosition();
      }
      return nextOpen;
    });
  }, [disabled, updatePosition]);

  const handleOptionClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const isOptionDisabled = event.currentTarget.dataset.optionDisabled === "true";
      if (isOptionDisabled) {
        return;
      }

      const nextValue = event.currentTarget.dataset.optionValue;
      if (nextValue === undefined) {
        return;
      }

      selectValue(nextValue);
    },
    [selectValue],
  );

  const menuId = id ? `${id}-menu` : undefined;
  const menuStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
        maxHeight: position.maxHeight,
      }
    : undefined;

  return (
    <div className={containerClassName} ref={rootRef}>
      <label htmlFor={id} className={labelClassName}>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>

      <div className="relative">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={handleTriggerClick}
          className={getTriggerButtonClassName(disabled)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-invalid={error ? "true" : "false"}
        >
          <span className={getSelectedValueClassName(Boolean(selectedOption))}>
            {selectedOption?.imageUrl ? (
              <img
                src={selectedOption.imageUrl}
                alt=""
                aria-hidden="true"
                className="h-6 w-6 shrink-0 rounded object-cover"
                loading="lazy"
              />
            ) : null}
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
          </span>
          <LuChevronDown className={getChevronIconClassName(isOpen)} />
        </button>
      </div>

      {isOpen && !disabled && position && typeof document !== "undefined"
        ? createPortal(
            <div
              id={menuId}
              ref={listRef}
              className={getMenuClassName(hideScrollbar)}
              role="listbox"
              aria-label={label}
              style={menuStyle}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                const isOptionDisabled = Boolean(option.disabled);

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isOptionDisabled}
                    data-option-value={option.value}
                    data-option-disabled={isOptionDisabled ? "true" : "false"}
                    onClick={handleOptionClick}
                    className={getOptionClassName(isOptionDisabled, isSelected)}
                  >
                    <span className="flex items-center gap-2">
                      {option.imageUrl ? (
                        <img
                          src={option.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="h-7 w-7 shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="truncate">{option.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
