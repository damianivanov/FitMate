import { LuActivity, LuFlame, LuTarget } from "react-icons/lu";
import type { WeekSnapshot as WeekSnapshotModel } from "../hooks/useTrainingWeek";

type WeekSnapshotProps = {
  snapshot: WeekSnapshotModel;
};

function formatVolume(totalKg: number): { value: string; unit: string } {
  return totalKg >= 1000
    ? { value: (totalKg / 1000).toFixed(1), unit: "t" }
    : { value: String(Math.round(totalKg)), unit: "kg" };
}

export function WeekSnapshot({ snapshot }: WeekSnapshotProps) {
  const volume = formatVolume(snapshot.volumeKg);
  const change = snapshot.volumeChangePercent;

  return (
    <div className="wk-snapshots">
      <article className="wk-snapshot tint-orange">
        <div>
          <LuFlame className="h-4 w-4" fill="currentColor" />
          <span>Streak</span>
        </div>
        <b>
          {snapshot.streakDays}
          <small> {snapshot.streakDays === 1 ? "day" : "days"}</small>
        </b>
        <p>{snapshot.streakDays > 0 ? "Keep it running" : "Train today to start one"}</p>
      </article>

      <article className="wk-snapshot tint-blue">
        <div>
          <LuTarget className="h-4 w-4" />
          <span>Sessions</span>
        </div>
        <b>{snapshot.sessionCount}</b>
        <p>Finished this week</p>
      </article>

      <article className="wk-snapshot tint-purple">
        <div>
          <LuActivity className="h-4 w-4" />
          <span>Volume</span>
        </div>
        <b>
          {volume.value}
          <small> {volume.unit}</small>
        </b>
        <p>
          {change == null
            ? "No week to compare"
            : `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change))}% vs last week`}
        </p>
      </article>
    </div>
  );
}
