import { useState } from "react";
import { Tooltip } from "@mui/material";
import { LuImage, LuSearch } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import type { Exercise } from "@/types";

const previewTooltipSlotProps = {
  tooltip: {
    sx: {
      backgroundColor: "white",
      color: "#0f172a",
      border: "1px solid #ffffffb3",
      boxShadow: "0 18px 36px #0000001f",
      borderRadius: "16px",
      p: 1,
    },
  },
  arrow: {
    sx: {
      color: "white",
    },
  },
} as const;

/**
 * Name-column cell: the exercise name plus an image-preview trigger. On desktop the
 * preview opens on hover; on touch/mobile (where hover doesn't exist) the trigger
 * becomes a tappable button that toggles the preview.
 */
export function ExerciseNameCell({ exercise }: { exercise: Exercise }) {
  const isMobile = useIsMobileViewport();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const imageUrl = exercise.imageUrl?.trim();

  return (
    <div className="flex w-full items-center gap-2">
      <span className="truncate">{exercise.name}</span>
      {imageUrl ? (
        <Tooltip
          arrow
          placement={isMobile ? "top" : "right"}
          enterDelay={80}
          open={isPreviewOpen}
          onOpen={() => {
            if (!isMobile) {
              setIsPreviewOpen(true);
            }
          }}
          onClose={() => setIsPreviewOpen(false)}
          disableHoverListener={isMobile}
          disableFocusListener={isMobile}
          disableTouchListener
          slotProps={previewTooltipSlotProps}
          title={
            <img
              src={imageUrl}
              alt={`${exercise.name} preview`}
              className="h-52 w-80 rounded-xl object-contain"
              loading="lazy"
            />
          }
        >
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                setIsPreviewOpen((open) => !open);
              }
            }}
            className="liquid-pill inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-secondary"
            aria-label={`Preview ${exercise.name} image`}
          >
            <LuImage className="h-4 w-4" />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

/**
 * Search box rendered inside the Name column header. It keeps its own input value so the
 * grid's column definitions can stay referentially stable — otherwise the header would
 * remount on every keystroke and steal focus. Pointer/key events are stopped from
 * bubbling so the DataGrid doesn't treat typing/clicking as header sorting or navigation.
 */
export function ExerciseSearchHeader({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div
      className="liquid-input flex w-full items-center gap-2 rounded-full px-3 py-1.5"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <LuSearch className="h-3.5 w-3.5 shrink-0 text-primary" />
      <input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        placeholder="Search name or slug"
        aria-label="Search exercises by name or slug"
        className="w-full bg-transparent text-sm font-normal text-foreground outline-none placeholder:text-tertiary"
      />
    </div>
  );
}
