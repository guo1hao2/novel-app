import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}));

import {
  applyThemeModeToWebDocument,
  DEFAULT_THEME_MODE,
  THEME_MODE_STORAGE_KEY,
  getThemeForMode,
  getInitialThemeMode,
  loadThemeMode,
  normalizeThemeMode,
  saveThemeMode
} from "../src/theme";

const localStorageMock = (() => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value))
  };
})();

describe("theme mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageMock
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { documentElement: { dataset: {} } }
    });
  });

  it("defaults to light mode", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    await expect(loadThemeMode()).resolves.toBe(DEFAULT_THEME_MODE);
    expect(DEFAULT_THEME_MODE).toBe("light");
  });

  it("normalizes invalid stored values back to light mode", () => {
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("system")).toBe("light");
    expect(normalizeThemeMode(null)).toBe("light");
  });

  it("persists manual dark mode selection", async () => {
    await saveThemeMode("dark");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_MODE_STORAGE_KEY, "dark");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(THEME_MODE_STORAGE_KEY, "dark");
  });

  it("provides distinct dark and light palettes", () => {
    expect(getThemeForMode("light").colors.background).not.toBe(getThemeForMode("dark").colors.background);
    expect(getThemeForMode("dark").colors.text).not.toBe(getThemeForMode("dark").colors.background);
  });

  it("can initialize and apply theme mode synchronously on web", () => {
    localStorageMock.setItem(THEME_MODE_STORAGE_KEY, "dark");

    expect(getInitialThemeMode()).toBe("dark");
    applyThemeModeToWebDocument("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
