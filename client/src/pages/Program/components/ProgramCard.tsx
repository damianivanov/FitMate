import { LuDumbbell, LuHistory } from "react-icons/lu";
import { ActionMenu, NativeGlyph, type ActionMenuItem } from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import { PLAN_STATUS_LABELS } from "@/shared/utils/programDisplay";
import { ProgramPlanStatus, type ProgramPlanModel } from "@/types";

type ProgramCardProps = {
  plan: ProgramPlanModel;
  menuItems: ActionMenuItem[];
  onOpen: (plan: ProgramPlanModel) => void;
};

export function ProgramCard({ plan, menuItems, onOpen }: ProgramCardProps) {
  function handleOpen() {
    onOpen(plan);
  }

  const isCompleted = plan.status === ProgramPlanStatus.Completed;

  return (
    <article className="relative min-w-0">
      <button type="button" className="native-tile h-full w-full" onClick={handleOpen}>
        <NativeGlyph tint={isCompleted ? "blue" : "purple"}>
          {isCompleted ? <LuHistory className="h-5 w-5" /> : <LuDumbbell className="h-5 w-5" />}
        </NativeGlyph>
        <b className="w-full break-words">{plan.name}</b>
        <small>{plan.targetWorkoutsPerWeek} days/week · from {formatDateOnly(plan.startDate)}</small>
        <em>{PLAN_STATUS_LABELS[plan.status]}</em>
      </button>
      <div className="absolute right-2 top-2">
        <ActionMenu triggerAriaLabel={`${plan.name} actions`} items={menuItems} />
      </div>
    </article>
  );
}
