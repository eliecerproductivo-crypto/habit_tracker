import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-ink-soft transition-colors hover:text-signal cursor-pointer"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
