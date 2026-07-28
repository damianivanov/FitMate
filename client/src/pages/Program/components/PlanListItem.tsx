import { LuCalendarDays, LuEye, LuLoaderCircle, LuPencil, LuTrash2 } from "react-icons/lu";
import { ActionMenu, type ActionMenuItem } from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  PLAN_STATUS_BADGE_CLASSES,
  PLAN_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlanModel } from "@/types";

type PlanListItemProps = {
  plan: ProgramPlanModel;
  isDeleting: boolean;
  onOpen: (plan: ProgramPlanModel) => void;
  onEdit: (plan: ProgramPlanModel) => void;
  onOpenCalendar: (plan: ProgramPlanModel) => void;
  onDelete: (plan: ProgramPlanModel) => void;
};

export function PlanListItem({
  plan,
  isDeleting,
  onOpen,
  onEdit,
  onOpenCalendar,
  onDelete,
}: PlanListItemProps) {
  const isDraft = plan.status === ProgramPlanStatus.Draft;

  const menuItems: ActionMenuItem[] = [
    {
      key: "view",
      label: "View",
      icon: <LuEye className="h-4 w-4 shrink-0" />,
      onSelect: () => onOpen(plan),
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: <LuCalendarDays className="h-4 w-4 shrink-0" />,
      onSelect: () => onOpenCalendar(plan),
    },
  ];

  if (isDraft) {
    menuItems.push(
      {
        key: "edit",
        label: "Edit draft",
        icon: <LuPencil className="h-4 w-4 shrink-0" />,
        onSelect: () => onEdit(plan),
      },
      {
        key: "delete",
        label: "Delete draft",
        icon: isDeleting ? (
          <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LuTrash2 className="h-4 w-4 shrink-0" />
        ),
        onSelect: () => onDelete(plan),
        variant: "danger",
        disabled: isDeleting,
      },
    );
  }

  return (
    <article className="liquid-panel flex items-center justify-between gap-3 rounded-2xl p-4">
      <button
        type="button"
        onClick={() => onOpen(plan)}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label={`Open ${plan.name}`}
      >
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-bold text-foreground">{plan.name}</h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${PLAN_STATUS_BADGE_CLASSES[plan.status]}`}
          >
            {PLAN_STATUS_LABELS[plan.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-secondary">
          {TRAINING_GOAL_LABELS[plan.goal]} · {SCHEDULE_TYPE_LABELS[plan.scheduleType]} ·{" "}
          {formatDateOnly(plan.startDate)} · {formatPlanDuration(plan)}
        </p>
      </button>
      <ActionMenu triggerAriaLabel={`${plan.name} actions`} items={menuItems} />
    </article>
  );
}
