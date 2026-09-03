import { createTheme, type Theme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

export type GridThemeMode = "light" | "dark";

type GridThemeTokens = {
  background: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  divider: string;
  primary: string;
  error: string;
};

const TOKENS: Record<GridThemeMode, GridThemeTokens> = {
  light: {
    background: "#dfe6f0",
    paper: "#e0e8f4",
    textPrimary: "#121212",
    textSecondary: "#21242b",
    textDisabled: "#8e8e93",
    divider: "rgba(28, 28, 30, 0.14)",
    primary: "#eb6226",
    error: "#ff3b30",
  },
  dark: {
    background: "#0c0f16",
    paper: "#0e1220",
    textPrimary: "#f0f2f8",
    textSecondary: "#c4cde0",
    textDisabled: "#65728a",
    divider: "rgba(255, 255, 255, 0.10)",
    primary: "#ff7337",
    error: "#ff4353",
  },
};

const menuSurface = {
  background: "var(--menu-bg)",
  border: "1px solid var(--menu-border)",
  boxShadow: "var(--menu-shadow)",
  backdropFilter: "blur(48px)",
  WebkitBackdropFilter: "blur(48px)",
  borderRadius: "var(--liquid-r-sm)",
  color: "var(--text-primary)",
} as const;

export function createGridTheme(mode: GridThemeMode): Theme {
  const tokens = TOKENS[mode];

  return createTheme({
    palette: {
      mode,
      primary: { main: tokens.primary },
      error: { main: tokens.error },
      background: { default: tokens.background, paper: tokens.paper },
      text: {
        primary: tokens.textPrimary,
        secondary: tokens.textSecondary,
        disabled: tokens.textDisabled,
      },
      divider: tokens.divider,
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: "var(--font-sans)" },
    components: {
      MuiPaper: {
        styleOverrides: { root: menuSurface },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { ...menuSurface, fontSize: "0.75rem", padding: "0.375rem 0.625rem" },
          arrow: { color: "var(--menu-border)" },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          panel: {
            "& .MuiDataGrid-paper": {
              background: "transparent",
              border: 0,
              boxShadow: "none",
            },
          },
          menuList: { color: "var(--text-primary)" },
          columnsManagementHeader: { borderColor: "var(--menu-border)" },
          columnsManagementFooter: { borderColor: "var(--menu-border)" },
        },
      },
    },
  });
}
