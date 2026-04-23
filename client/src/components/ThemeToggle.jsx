import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`theme-switch ${isDark ? "dark" : "light"}`}
      onClick={toggleTheme}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleTheme()}
      role="button"
      aria-label="Toggle theme"
    >
      <div className="switch-track">
        <div className="switch-thumb">
          <span className="icon">{isDark ? "🌙" : "☀️"}</span>
        </div>
      </div>
    </div>
  );
}
