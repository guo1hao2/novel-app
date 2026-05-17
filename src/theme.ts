import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceGlass: string;
  primary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  success: string;
  input: string;
  shadow: string;
};

export type AppTheme = {
  mode: ThemeMode;
  colors: ThemeColors;
};

export const THEME_MODE_STORAGE_KEY = "novel-ai-writer.themeMode";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

export const lightTheme: AppTheme = {
  mode: "light",
  colors: {
    background: "#F4F6F1",
    surface: "#FFFEFA",
    surfaceAlt: "#ECEFEB",
    surfaceGlass: "rgba(255, 254, 250, 0.92)",
    primary: "#1F3D36",
    primarySoft: "#DDE9E3",
    accent: "#4D6F91",
    accentSoft: "#E5EEF6",
    text: "#16211D",
    muted: "#718079",
    border: "#E2E6E0",
    danger: "#B3263A",
    success: "#2C7A57",
    input: "#FFFFFF",
    shadow: "#13221D"
  }
};

export const darkTheme: AppTheme = {
  mode: "dark",
  colors: {
    background: "#08110E",
    surface: "#101B17",
    surfaceAlt: "#172620",
    surfaceGlass: "rgba(16, 27, 23, 0.94)",
    primary: "#A8D8C4",
    primarySoft: "#20392F",
    accent: "#A7C7E7",
    accentSoft: "#1D3142",
    text: "#F3F8F5",
    muted: "#A7B5AF",
    border: "#263A33",
    danger: "#FCA5A5",
    success: "#86EFAC",
    input: "#0E1814",
    shadow: "#000000"
  }
};

export const colors = lightTheme.colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40
};

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  return value === "dark" ? "dark" : DEFAULT_THEME_MODE;
}

export function getThemeForMode(mode: ThemeMode): AppTheme {
  return mode === "dark" ? darkTheme : lightTheme;
}

export function getInitialThemeMode(): ThemeMode {
  return normalizeThemeMode(getBrowserThemeStorage()?.getItem(THEME_MODE_STORAGE_KEY));
}

export function applyThemeModeToWebDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    return normalizeThemeMode((await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)) ?? getBrowserThemeStorage()?.getItem(THEME_MODE_STORAGE_KEY));
  } catch {
    return getInitialThemeMode();
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  getBrowserThemeStorage()?.setItem(THEME_MODE_STORAGE_KEY, mode);
  applyThemeModeToWebDocument(mode);
  await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}

function getBrowserThemeStorage(): Storage | undefined {
  if (typeof globalThis.localStorage === "undefined") return undefined;
  return globalThis.localStorage;
}
