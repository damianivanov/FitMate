import type { CSSProperties } from "react";

export const CHART_PRIMARY = "var(--color-primary)";
export const CHART_GRID_STROKE = "var(--glass-divider)";

export const CHART_AXIS_TICK = { fontSize: 11, fill: "var(--text-muted)" } as const;

export const CHART_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--glass-divider)",
  borderRadius: 12,
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
  fontSize: 12,
  padding: "8px 12px",
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "var(--text-muted)",
  fontWeight: 600,
  marginBottom: 2,
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "var(--color-foreground)",
};
