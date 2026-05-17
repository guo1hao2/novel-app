import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn()
}));

import { DEFAULT_PROVIDER } from "../src/features/settings/defaultProvider";
import { isValidSecureStoreKey } from "../src/storage/secureApiKey";

describe("DEFAULT_PROVIDER", () => {
  it("uses the DeepSeek OpenAI-compatible endpoint without embedding an API key", () => {
    expect(DEFAULT_PROVIDER.name).toBe("DeepSeek");
    expect(DEFAULT_PROVIDER.baseUrl).toBe("https://api.deepseek.com");
    expect(DEFAULT_PROVIDER.model).toBe("deepseek-chat");
    expect(DEFAULT_PROVIDER.maxTokens).toBe(393216);
    expect(DEFAULT_PROVIDER.apiKeyStorageKey).toBe("provider-api-key.deepseek");
    expect(isValidSecureStoreKey(DEFAULT_PROVIDER.apiKeyStorageKey)).toBe(true);
    expect(JSON.stringify(DEFAULT_PROVIDER)).not.toContain("sk-");
  });
});
