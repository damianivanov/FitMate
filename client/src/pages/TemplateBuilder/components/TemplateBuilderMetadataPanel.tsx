import { useMemo, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { LuChevronDown, LuEye, LuLock } from "react-icons/lu";
import { SegmentControl, SegmentControlSize, type SegmentControlOption } from "@/shared/components";
import { DurationSetPickerPopover } from "@/shared/components/WorkoutSetPickers/DurationSetPickerPopover";

const VISIBILITY_OPTIONS: ReadonlyArray<SegmentControlOption<boolean>> = [
  { value: false, label: "Private" },
  { value: true, label: "Public" },
];

const DURATION_MIN_MINUTES = 10;
const DURATION_MAX_MINUTES = 180;
const DURATION_STEP_MINUTES = 1;
const DURATION_PRESET_MINUTES = [30, 45, 60, 75, 90, 120] as const;
const TEMPLATE_DESCRIPTION_MIN_ROWS = 2;
const TEMPLATE_DESCRIPTION_MAX_ROWS = 6;

type TemplateBuilderMetadataPanelProps = {
  templateName: string;
  templateDescription: string;
  durationMinutes: number;
  isPublic: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onIsPublicChange: (value: boolean) => void;
};

export function TemplateBuilderMetadataPanel({
  templateName,
  templateDescription,
  durationMinutes,
  isPublic,
  onNameChange,
  onDescriptionChange,
  onDurationChange,
  onIsPublicChange,
}: TemplateBuilderMetadataPanelProps) {
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(true);
  const [isDurationPickerOpen, setIsDurationPickerOpen] = useState(false);
  const [durationPickerAnchorElement, setDurationPickerAnchorElement] = useState<HTMLElement | null>(null);

  const templateDescriptionRows = useMemo(() => {
    const lineCount = templateDescription.split(/\r\n|\r|\n/).length;
    return Math.min(
      TEMPLATE_DESCRIPTION_MAX_ROWS,
      Math.max(TEMPLATE_DESCRIPTION_MIN_ROWS, lineCount),
    );
  }, [templateDescription]);

  const trimmedTemplateName = templateName.trim();
  const collapsedTemplateName = trimmedTemplateName.length > 0
    ? trimmedTemplateName
    : "Name...";
  const hasTemplateName = trimmedTemplateName.length > 0;
  const visibilityLabel = isPublic ? "Public" : "Private";
  const VisibilityIcon = isPublic ? LuEye : LuLock;

  const handleTemplateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNameChange(event.target.value);
  };

  const handleTemplateDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onDescriptionChange(event.target.value);
  };

  const handleDurationPickerOpen = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setDurationPickerAnchorElement(event.currentTarget);
    setIsDurationPickerOpen(true);
  };

  const handleDurationPickerClose = () => {
    setIsDurationPickerOpen(false);
  };

  const handleVisibilityChange = (nextIsPublic: boolean) => {
    onIsPublicChange(nextIsPublic);
  };

  const handleBuilderCollapseToggle = () => {
    setIsDurationPickerOpen(false);
    setIsBuilderCollapsed((previous) => !previous);
  };

  return (
    <>
      <div
        className={[
          "liquid-panel rounded-2xl md:rounded-lg p-2",
          isBuilderCollapsed && "md:p-5",
        ].join(" ")}
      >
        <div className="grid gap-3 lg:grid-cols-1">
          {isBuilderCollapsed ? (
            <button
              type="button"
              onClick={handleBuilderCollapseToggle}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-1 text-left"
              aria-label="Expand builder details"
            >
              <span
                className={
                  hasTemplateName
                    ? "min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground"
                    : "min-w-0 flex-1 truncate px-1 text-sm font-semibold text-muted"
                }
              >
                {collapsedTemplateName}
              </span>
              <span className="liquid-pill inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-primary-700">
                <VisibilityIcon className="h-3.5 w-3.5" />
                <span>{visibilityLabel}</span>
              </span>
              <span className="liquid-pill flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <LuChevronDown className="h-4 w-4 text-muted" />
              </span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  value={templateName}
                  onChange={handleTemplateNameChange}
                  placeholder="Name..."
                  className="liquid-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={handleDurationPickerOpen}
                  className="liquid-primary-chip mono flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  aria-label="Edit duration"
                >
                  {durationMinutes} min
                </button>
                <div className="order-last w-full shrink-0 sm:order-0 sm:w-40 xl:w-44">
                  <SegmentControl
                    className="w-full"
                    value={isPublic}
                    options={VISIBILITY_OPTIONS}
                    size={SegmentControlSize.Md}
                    onChange={handleVisibilityChange}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBuilderCollapseToggle}
                  className="liquid-pill ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full"
                  aria-label={isBuilderCollapsed ? "Expand builder details" : "Collapse builder details"}
                >
                  <LuChevronDown
                    className={[
                      "h-4 w-4 text-muted transition-transform",
                      isBuilderCollapsed ? "rotate-0" : "rotate-180",
                    ].join(" ")}
                  />
                </button>
              </div>

              <div className="min-w-0">
                <textarea
                  rows={templateDescriptionRows}
                  value={templateDescription}
                  onChange={handleTemplateDescriptionChange}
                  placeholder="Short description..."
                  className="liquid-input w-full resize-none rounded-xl px-3 py-2 text-sm leading-snug"
                />
              </div>
            </>
          )}
        </div>
      </div>
      <DurationSetPickerPopover
        isOpen={isDurationPickerOpen}
        value={durationMinutes}
        onChange={onDurationChange}
        onClose={handleDurationPickerClose}
        title="Duration"
        anchorElement={durationPickerAnchorElement}
        min={DURATION_MIN_MINUTES}
        max={DURATION_MAX_MINUTES}
        step={DURATION_STEP_MINUTES}
        quickPresets={DURATION_PRESET_MINUTES}
        unitLabel="min"
        quickPresetSuffix="m"
      />
    </>
  );
}
