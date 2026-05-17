import type { ApiProvider } from "../../types";
import { MAX_TOKENS_UPPER_BOUND } from "./maxTokens";

export const DEFAULT_API_KEY_STORAGE_KEY = "provider-api-key.deepseek";

export const DEEPSEEK_VENDOR_CONFIG = {
  baseUrl: "https://api.deepseek.com",
  models: {
    pro: "deepseek-reasoner",
    chat: "deepseek-chat"
  }
} as const;

export const DEFAULT_PROVIDER: ApiProvider = {
  id: "deepseek",
  name: "DeepSeek",
  vendor: "deepseek",
  baseUrl: DEEPSEEK_VENDOR_CONFIG.baseUrl,
  model: DEEPSEEK_VENDOR_CONFIG.models.chat,
  temperature: 0.5,
  maxTokens: MAX_TOKENS_UPPER_BOUND,
  apiKeyStorageKey: DEFAULT_API_KEY_STORAGE_KEY
};
