import * as SecureStore from "expo-secure-store";

import { DEFAULT_API_KEY_STORAGE_KEY } from "../features/settings/defaultProvider";

const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidSecureStoreKey(key: string): boolean {
  return SECURE_STORE_KEY_PATTERN.test(key);
}

export function normalizeSecureStoreKey(key: string): string {
  const trimmedKey = key.trim();
  return isValidSecureStoreKey(trimmedKey) ? trimmedKey : DEFAULT_API_KEY_STORAGE_KEY;
}

export async function getApiKey(storageKey: string): Promise<string> {
  const normalizedKey = normalizeSecureStoreKey(storageKey);

  if (await canUseNativeSecureStore()) {
    try {
      return (await SecureStore.getItemAsync(normalizedKey)) ?? "";
    } catch (error) {
      if (!isMissingNativeSecureStoreMethod(error)) throw error;
    }
  }

  return getFallbackValue(normalizedKey);
}

export async function setApiKey(storageKey: string, value: string): Promise<void> {
  const normalizedKey = normalizeSecureStoreKey(storageKey);
  const trimmedValue = value.trim();

  if (await canUseNativeSecureStore()) {
    try {
      if (trimmedValue) {
        await SecureStore.setItemAsync(normalizedKey, trimmedValue);
      } else {
        await SecureStore.deleteItemAsync(normalizedKey);
      }
      return;
    } catch (error) {
      if (!isMissingNativeSecureStoreMethod(error)) throw error;
    }
  }

  if (trimmedValue) {
    setFallbackValue(normalizedKey, trimmedValue);
    return;
  }

  deleteFallbackValue(normalizedKey);
}

async function canUseNativeSecureStore(): Promise<boolean> {
  try {
    const maybeSecureStore = SecureStore as Partial<typeof SecureStore>;
    return Boolean(await maybeSecureStore.isAvailableAsync?.());
  } catch {
    return false;
  }
}

function isMissingNativeSecureStoreMethod(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes("getValueWithKeyAsync");
}

function getFallbackValue(key: string): string {
  return getBrowserStorage()?.getItem(key) ?? "";
}

function setFallbackValue(key: string, value: string): void {
  getBrowserStorage()?.setItem(key, value);
}

function deleteFallbackValue(key: string): void {
  getBrowserStorage()?.removeItem(key);
}

function getBrowserStorage(): Storage | undefined {
  if (typeof globalThis.localStorage === "undefined") return undefined;
  return globalThis.localStorage;
}
