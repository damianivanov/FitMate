import { LuMoon, LuSun } from "react-icons/lu";
import { useThemeStore } from "@/stores/themeStore";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition"
      style={{
        background: isDark
          ? "rgba(250, 204, 21, 0.10)"
          : "rgba(99, 102, 241, 0.10)",
        border: `1px solid ${isDark ? "rgba(250, 204, 21, 0.20)" : "rgba(99, 102, 241, 0.20)"}`,
        boxShadow: isDark
          ? "0 0 12px rgba(250, 204, 21, 0.15), 0 0 4px rgba(250, 204, 21, 0.10)"
          : "0 0 12px rgba(99, 102, 241, 0.15), 0 0 4px rgba(99, 102, 241, 0.10)",
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <LuSun className="h-4 w-4" style={{ color: "#facc15", filter: "drop-shadow(0 0 4px rgba(250, 204, 21, 0.50))" }} />
      ) : (
        <LuMoon className="h-4 w-4" style={{ color: "#818cf8", filter: "drop-shadow(0 0 4px rgba(129, 140, 248, 0.50))" }} />
      )}
    </button>
  );
}
