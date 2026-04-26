import { useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { LuChevronDown } from "react-icons/lu";
import { SegmentControl, type SegmentControlOption } from "@/shared/components";
import { useTemplateBuilderStore } from "../store/templateBuilderStore";

type DurationSliderStyle = CSSProperties & {
  "--duration-slider-progress": string;
};

const VISIBILITY_OPTIONS: ReadonlyArray<SegmentControlOption<boolean>> = [
  { value: false, label: "Private" },
  { value: true, label: "Public" },
];

const DURATION_MIN_MINUTES = 10;
const DURATION_MAX_MINUTES = 180;
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

  const durationProgressPercent = useMemo(() => {
    const durationRange = DURATION_MAX_MINUTES - DURATION_MIN_MINUTES;
    if (durationRange <= 0) {
      return 0;
    }

    return ((durationMinutes - DURATION_MIN_MINUTES) / durationRange) * 100;
  }, [durationMinutes]);

  const durationSliderStyle = useMemo<DurationSliderStyle>(
    () => ({
      "--duration-slider-progress": `${durationProgressPercent}%`,
    }),
    [durationProgressPercent],
  );

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

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDurationMinutes(Number(event.target.value));
  };

  const handleVisibilityChange = (isPublic: boolean) => {
    setIsPublic(isPublic);
  };

  const handleBuilderCollapseToggle = () => {
    setIsBuilderCollapsed((previous) => !previous);
  };

  return (
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
            <div className="flex items-center gap-2">
              <input
                value={templateName}
                onChange={handleTemplateNameChange}
                placeholder="Template name..."
                className="liquid-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-medium"
              />
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

            <div className="min-w-0">
              <textarea
                rows={templateDescriptionRows}
                value={templateDescription}
                onChange={handleTemplateDescriptionChange}
                placeholder="Short description..."
                className="liquid-input w-full resize-none rounded-xl px-3 py-2 text-sm leading-snug"
              />
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="min-w-0 lg:w-40 xl:w-44">
                <SegmentControl
                  className="w-full"
                  value={isPublic}
                  options={VISIBILITY_OPTIONS}
                  onChange={handleVisibilityChange}
                />
              </div>
              <div className="min-w-0 lg:flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={DURATION_MIN_MINUTES}
                    max={DURATION_MAX_MINUTES}
                    value={durationMinutes}
                    onChange={handleDurationChange}
                    style={durationSliderStyle}
                    className="liquid-duration-slider liquid-duration-slider-compact min-w-0 flex-1"
                  />
                  <span className="liquid-primary-chip mono inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {durationMinutes} min
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
