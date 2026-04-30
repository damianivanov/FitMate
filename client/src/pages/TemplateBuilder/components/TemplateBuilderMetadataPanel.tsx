import { useMemo, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { LuChevronDown, LuClock } from "react-icons/lu";
import { SegmentControl, SegmentControlSize, type SegmentControlOption } from "@/shared/components";
import { DurationSetPickerPopover } from "./DurationSetPickerPopover";
import { useTemplateBuilderStore } from "../store/templateBuilderStore";

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

export function TemplateBuilderMetadataPanel() {
  const templateName = useTemplateBuilderStore((state) => state.templateName);
  const templateDescription = useTemplateBuilderStore((state) => state.templateDescription);
  const durationMinutes = useTemplateBuilderStore((state) => state.durationMinutes);
  const isPublic = useTemplateBuilderStore((state) => state.isPublic);

  const setTemplateName = useTemplateBuilderStore((state) => state.setTemplateName);
  const setTemplateDescription = useTemplateBuilderStore((state) => state.setTemplateDescription);
  const setDurationMinutes = useTemplateBuilderStore((state) => state.setDurationMinutes);
  const setIsPublic = useTemplateBuilderStore((state) => state.setIsPublic);
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(false);
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
    : "Template name...";
  const hasTemplateName = trimmedTemplateName.length > 0;

  const handleTemplateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTemplateName(event.target.value);
  };

  const handleTemplateDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTemplateDescription(event.target.value);
  };

  const handleDurationPickerOpen = (event: ReactMouseEvent<HTMLButtonElement>) => {
    setDurationPickerAnchorElement(event.currentTarget);
    setIsDurationPickerOpen(true);
  };

  const handleDurationPickerClose = () => {
    setIsDurationPickerOpen(false);
  };

  const handleVisibilityChange = (isPublic: boolean) => {
    setIsPublic(isPublic);
  };

  const handleBuilderCollapseToggle = () => {
    setIsDurationPickerOpen(false);
    setIsBuilderCollapsed((previous) => !previous);
  };

  return (
    <>
      <div className="liquid-panel rounded-2xl p-2 md:rounded-lg md:p-5">
        <div className="grid gap-3 lg:grid-cols-1">
          {isBuilderCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={
                    hasTemplateName
                      ? "min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground"
                      : "min-w-0 flex-1 truncate px-1 text-sm font-semibold text-muted"
                  }
                >
                  {collapsedTemplateName}
                </p>
                <button
                  type="button"
                  onClick={handleBuilderCollapseToggle}
                  className="liquid-pill flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full"
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
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  value={templateName}
                  onChange={handleTemplateNameChange}
                  placeholder="Template name..."
                  className="liquid-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-medium sm:max-w-md"
                />
                <button
                  type="button"
                  onClick={handleDurationPickerOpen}
                  className="liquid-input flex min-h-10 w-max max-w-full shrink-0 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  aria-label="Edit template duration"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <LuClock className="h-4 w-4 shrink-0 text-primary" />
                    <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted sm:inline">
                      Duration
                    </span>
                  </span>
                  <span className="liquid-primary-chip mono inline-flex min-w-14 shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {durationMinutes} min
                  </span>
                </button>
                <div className="order-last w-full shrink-0 sm:order-none sm:w-40 xl:w-44">
                  <SegmentControl
                    className="w-full"
                    value={isPublic}
                    options={VISIBILITY_OPTIONS}
                    size={SegmentControlSize.Lg}
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
        onChange={setDurationMinutes}
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
