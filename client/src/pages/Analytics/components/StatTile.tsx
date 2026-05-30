type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="liquid-info-surface rounded-xl px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
