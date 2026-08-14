import { LuCheck } from "react-icons/lu";
import { NativeMeter } from "@/shared/components";
import type { FeatureAvailabilityModel } from "@/types";
import { FEATURE_LABELS } from "./features";

type UsageBarProps = {
  availability: FeatureAvailabilityModel;
};

export function UsageBar({ availability }: UsageBarProps) {
  const label = FEATURE_LABELS[availability.feature] ?? `Feature ${availability.feature}`;

  if (!availability.isEnabled) {
    return (
      <div className="sub-usage-flat">
        <b>{label}</b>
        <small>Not included</small>
      </div>
    );
  }

  // A null limit means the plan grants this without a ceiling, so there is no meter to draw.
  if (availability.limit == null) {
    return (
      <div className="sub-usage-flat">
        <b>{label}</b>
        <small className="sub-usage-unlimited">
          <LuCheck className="h-4 w-4" strokeWidth={3} />
          Unlimited
        </small>
      </div>
    );
  }

  const consumed = availability.used + availability.reserved;
  const percentage =
    availability.limit === 0 ? 100 : Math.min(100, (consumed / availability.limit) * 100);

  return (
    <div className={percentage >= 100 ? "sub-usage is-exhausted" : "sub-usage"}>
      <span>
        <b>{label}</b>
        <small>
          {consumed} of {availability.limit}
        </small>
      </span>
      <NativeMeter percent={percentage} label={label} />
    </div>
  );
}
