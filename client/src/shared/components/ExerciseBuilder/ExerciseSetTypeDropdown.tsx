import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { ExerciseSetType } from "@/types";

const MENU_WIDTH_PX = 128;
const MENU_ESTIMATED_HEIGHT_PX = 168;
const MENU_OFFSET_PX = 6;
const VIEWPORT_PADDING_PX = 8;

type SetTypeMenuPosition = { top: number; left: number };

type SetTypeOption = {
  value: ExerciseSetType;
  label: string;
};

type SetTypeOptionButtonProps = {
  option: SetTypeOption;
  isSelected: boolean;
  onSelect: (value: ExerciseSetType) => void;
};

type ExerciseSetTypeDropdownProps = {
  value: ExerciseSetType;
  setNumber: number;
  onChange: (value: ExerciseSetType) => void;
};

const SET_TYPE_OPTIONS: ReadonlyArray<SetTypeOption> = [
  { value: ExerciseSetType.Warmup, label: "Warm" },
  { value: ExerciseSetType.Working, label: "Work" },
  { value: ExerciseSetType.Dropset, label: "Drop" },
  { value: ExerciseSetType.Failure, label: "Fail" },
];

function getSetTypeOption(value: ExerciseSetType): SetTypeOption {
  return SET_TYPE_OPTIONS.find((option) => option.value === value) ?? SET_TYPE_OPTIONS[1];
}

function SetTypeOptionButton({
  option,
  isSelected,
  onSelect,
}: SetTypeOptionButtonProps) {
  const handleClick = () => {
    onSelect(option.value);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-xs font-extrabold transition-colors",
        isSelected
          ? "text-primary hover:bg-primary-100/10"
          : "text-secondary hover:bg-white/8 hover:text-primary",
      ].join(" ")}
    >
      <span>{option.label}</span>
      {isSelected ? <LuCheck className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function ExerciseSetTypeDropdown({
  value,
  setNumber,
  onChange,
}: ExerciseSetTypeDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<SetTypeMenuPosition | null>(null);
  const selectedOption = getSetTypeOption(value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const maxLeft = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerWidth - MENU_WIDTH_PX - VIEWPORT_PADDING_PX,
    );
    const resolvedLeft = Math.min(
      maxLeft,
      Math.max(VIEWPORT_PADDING_PX, triggerRect.left),
    );
    const shouldOpenUp =
      triggerRect.bottom + MENU_OFFSET_PX + MENU_ESTIMATED_HEIGHT_PX
        > window.innerHeight - VIEWPORT_PADDING_PX
      && triggerRect.top - MENU_OFFSET_PX - MENU_ESTIMATED_HEIGHT_PX
        >= VIEWPORT_PADDING_PX;

    setMenuPosition({
      top: shouldOpenUp
        ? triggerRect.top - MENU_OFFSET_PX - MENU_ESTIMATED_HEIGHT_PX
        : triggerRect.bottom + MENU_OFFSET_PX,
      left: resolvedLeft,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isOpen]);

  const handleTriggerClick = () => {
    setIsOpen((previous) => !previous);
  };

  const handleOptionSelect = useCallback((nextValue: ExerciseSetType) => {
    onChange(nextValue);
    setIsOpen(false);
  }, [onChange]);

  const menu =
    isOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="liquid-user-menu fixed z-50 w-32 rounded-2xl p-2"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {SET_TYPE_OPTIONS.map((option) => (
              <SetTypeOptionButton
                key={option.value}
                option={option}
                isSelected={option.value === value}
                onSelect={handleOptionSelect}
              />
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className={[
          "liquid-input inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-extrabold text-foreground transition sm:gap-2 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm",
          isOpen ? "border-primary-600 text-primary ring-2 ring-primary-300" : "",
        ].join(" ")}
        aria-expanded={isOpen}
        aria-label={`Set type for set ${setNumber}`}
      >
        <span>{selectedOption.label}</span>
        <LuChevronDown className="h-3 w-3 shrink-0 md:h-4 md:w-4" />
      </button>
      {menu}
    </>
  );
}
