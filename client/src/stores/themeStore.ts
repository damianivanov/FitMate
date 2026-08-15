import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("fitmate-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The first stop of --scene-gradient in each theme. The status bar sits directly above that
 * pixel, so anything else leaves a band of a different colour across the top of the app.
 * Keep these in step with --scene-gradient in index.css.
 */
const THEME_COLORS: Record<Theme, string> = {
  dark: "#0c0f16",
  light: "#dfe6f0",
};

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);

  try {
    localStorage.setItem("fitmate-theme", theme);
  } catch {
  }
}

const initialTheme = getStoredTheme();
applyTheme(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
