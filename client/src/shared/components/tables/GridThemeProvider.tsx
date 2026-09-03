import type { ReactNode } from "react";
import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { useThemeStore } from "@/stores/themeStore";
import { createGridTheme } from "./gridTheme";

type GridThemeProviderProps = {
  children: ReactNode;
};

export default function GridThemeProvider({ children }: GridThemeProviderProps) {
  const { theme } = useThemeStore();
  const muiTheme = useMemo(() => createGridTheme(theme), [theme]);

  return <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>;
}
