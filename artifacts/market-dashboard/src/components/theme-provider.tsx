import { createContext, useContext, useEffect, useState } from "react";
import { loadSettings } from "@/lib/settings";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    // Listen for custom settings update event to reflect changes immediately
    const handleSettingsUpdated = () => {
      setSettings(loadSettings());
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("settingsUpdated", handleSettingsUpdated);
  }, []);

  const theme = settings.theme;
  const themeAccent = settings.themeAccent || "blue";

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let activeTheme = theme;
    if (theme === "system") {
      activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    root.classList.add(activeTheme);

    // Apply accent class (theme-blue, theme-emerald, theme-amber, theme-violet)
    root.classList.forEach((cls) => {
      if (cls.startsWith("theme-")) {
        root.classList.remove(cls);
      }
    });
    root.classList.add(`theme-${themeAccent}`);
  }, [theme, themeAccent]);

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
