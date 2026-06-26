import { createContext, useContext, useEffect, useState } from "react";
import { loadSettings } from "@/lib/settings";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState(loadSettings().theme);

  useEffect(() => {
    // Listen for custom settings update event to reflect changes immediately
    const handleSettingsUpdated = () => {
      setTheme(loadSettings().theme);
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("settingsUpdated", handleSettingsUpdated);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Also listen for system preference changes if in system mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return <>{children}</>;
}
