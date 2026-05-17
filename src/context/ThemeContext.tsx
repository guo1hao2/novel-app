import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_THEME_MODE,
  applyThemeModeToWebDocument,
  getThemeForMode,
  getInitialThemeMode,
  loadThemeMode,
  saveThemeMode,
  type AppTheme,
  type ThemeColors,
  type ThemeMode
} from "../theme";

type ThemeContextValue = {
  colors: ThemeColors;
  isNightMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  theme: AppTheme;
  themeMode: ThemeMode;
  toggleNightMode: (enabled: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getInitialThemeMode() ?? DEFAULT_THEME_MODE);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredMode() {
      const storedMode = await loadThemeMode();
      if (isMounted) {
        setThemeModeState(storedMode);
      }
    }

    void loadStoredMode();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyThemeModeToWebDocument(themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    applyThemeModeToWebDocument(mode);
    await saveThemeMode(mode);
  }, []);

  const toggleNightMode = useCallback(
    async (enabled: boolean) => {
      await setThemeMode(enabled ? "dark" : "light");
    },
    [setThemeMode]
  );

  const value = useMemo<ThemeContextValue>(() => {
    const theme = getThemeForMode(themeMode);

    return {
      colors: theme.colors,
      isNightMode: themeMode === "dark",
      setThemeMode,
      theme,
      themeMode,
      toggleNightMode
    };
  }, [setThemeMode, themeMode, toggleNightMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
