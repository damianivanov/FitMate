import type { NativeTint } from "@/shared/components";
import type { MuscleGroupVolume } from "@/types";

type MuscleBalanceProps = {
  items: MuscleGroupVolume[];
};

const BAR_TINTS: NativeTint[] = ["orange", "blue", "purple", "green", "cyan", "pink"];

export function MuscleBalance({ items }: MuscleBalanceProps) {
  if (items.length === 0) {
    return <p className="an-empty">No muscle group data yet.</p>;
  }

  // Shares of the biggest group rather than of the total: against the total every bar on a
  // balanced split lands near a tenth of the track and the comparison stops being readable.
  const peak = Math.max(...items.map((item) => item.totalVolumeKg), 1);
  const ranked = items.slice().sort((left, right) => right.totalVolumeKg - left.totalVolumeKg);

  return (
    <div className="an-balance">
      {ranked.map((item, index) => {
        const percent = Math.round((item.totalVolumeKg / peak) * 100);

        return (
          <div key={item.muscleGroupId}>
            <span>{item.muscleGroupName}</span>
            <i>
              <b
                className={`tint-${BAR_TINTS[index % BAR_TINTS.length]}`}
                style={{ width: `${percent}%` }}
              />
            </i>
            <strong>{percent}%</strong>
          </div>
        );
      })}
    </div>
  );
}
