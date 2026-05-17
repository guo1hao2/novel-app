import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";

vi.mock("expo-secure-store", () => ({
  isAvailableAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn()
}));

import { DEFAULT_API_KEY_STORAGE_KEY } from "../src/features/settings/defaultProvider";
import { getApiKey, isValidSecureStoreKey, normalizeSecureStoreKey, setApiKey } from "../src/storage/secureApiKey";

const localStorageMock = (() => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
})();

describe("SecureStore key helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageMock
    });
    vi.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true);
  });

  it("accepts only non-empty alphanumeric, dot, dash, and underscore keys", () => {
    expect(isValidSecureStoreKey("provider-api-key.deepseek")).toBe(true);
    expect(isValidSecureStoreKey("provider_api_key-deepseek.1")).toBe(true);
    expect(isValidSecureStoreKey("")).toBe(false);
    expect(isValidSecureStoreKey("provider-api-key:deepseek")).toBe(false);
    expect(isValidSecureStoreKey("provider api key")).toBe(false);
  });

  it("normalizes empty and legacy invalid keys to the safe default", () => {
    expect(normalizeSecureStoreKey("")).toBe(DEFAULT_API_KEY_STORAGE_KEY);
    expect(normalizeSecureStoreKey("provider-api-key:deepseek")).toBe(DEFAULT_API_KEY_STORAGE_KEY);
    expect(normalizeSecureStoreKey("provider-api-key.deepseek")).toBe("provider-api-key.deepseek");
  });

  it("never passes a legacy invalid key to SecureStore", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

    await getApiKey("provider-api-key:deepseek");

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(DEFAULT_API_KEY_STORAGE_KEY);
  });

  it("falls back to localStorage when native SecureStore is unavailable on web", async () => {
    vi.mocked(SecureStore.isAvailableAsync).mockResolvedValue(false);

    await setApiKey("provider-api-key:deepseek", "sk-test");
    const value = await getApiKey("provider-api-key:deepseek");

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(DEFAULT_API_KEY_STORAGE_KEY, "sk-test");
    expect(value).toBe("sk-test");
  });
});
