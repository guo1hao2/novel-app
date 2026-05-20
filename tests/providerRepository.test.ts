import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  setItemAsync: vi.fn()
}));

type MockDatabase = typeof import("./mocks/expoSqlite").mockDatabase;

function mockInitializedDatabase(db: MockDatabase) {
  db.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes("name = 'schema_version'")) return { name: "schema_version" };
    if (sql.includes("SELECT version FROM schema_version")) return { version: 8 };
    if (sql.includes("name = ?")) return { name: String(params?.[0] ?? "") };
    if (sql.includes("SELECT COUNT(*) as count FROM books")) return { count: 1 };
    if (sql.includes("SELECT COUNT(*) as count FROM skills")) return { count: 1 };
    if (sql.includes("SELECT is_active FROM api_providers WHERE id = ?")) return { is_active: 1 };
    if (sql.includes("SELECT COUNT(*) as count FROM api_providers")) return { count: 2 };
    return null;
  });
  db.getAllAsync.mockImplementation(async () => []);
}

async function loadRepository() {
  vi.resetModules();
  const sqlite = await import("./mocks/expoSqlite");
  sqlite.resetExpoSqliteMock();
  mockInitializedDatabase(sqlite.mockDatabase);
  const repository = await import("../src/storage/sqliteRepository");
  return { ...repository, db: sqlite.mockDatabase };
}

describe("api provider repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves an existing active provider when saving edited config", async () => {
    const { db, saveProvider } = await loadRepository();
    const provider = {
      id: "deepseek",
      name: "DeepSeek",
      vendor: "deepseek" as const,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      temperature: 0.5,
      maxTokens: 1000000,
      apiKeyStorageKey: "provider-api-key.deepseek"
    };

    await saveProvider(provider);

    const saveCall = db.runAsync.mock.calls.find((call: unknown[]) => String(call[0]).includes("INSERT OR REPLACE INTO api_providers"));
    expect(saveCall?.[1]).toEqual([
      "deepseek",
      "DeepSeek",
      "deepseek",
      "https://api.deepseek.com",
      "deepseek-v4-pro",
      0.5,
      393216,
      "provider-api-key.deepseek",
      1
    ]);
  });

  it("rejects deleting the last remaining provider", async () => {
    const { db, deleteProvider } = await loadRepository();
    db.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("name = 'schema_version'")) return { name: "schema_version" };
      if (sql.includes("SELECT version FROM schema_version")) return { version: 4 };
      if (sql.includes("name = ?")) return { name: String(params?.[0] ?? "") };
      if (sql.includes("SELECT COUNT(*) as count FROM books")) return { count: 1 };
      if (sql.includes("SELECT COUNT(*) as count FROM skills")) return { count: 1 };
      if (sql.includes("SELECT COUNT(*) as count FROM api_providers")) return { count: 1 };
      return null;
    });

    await expect(deleteProvider("deepseek")).rejects.toThrow("至少需要保留一个 Provider。");
    expect(db.runAsync.mock.calls.some((call: unknown[]) => String(call[0]).includes("DELETE FROM api_providers"))).toBe(false);
  });
});
