import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  setItemAsync: vi.fn()
}));

describe("SQLite schema recovery", () => {
  it("recreates the database when a stored schema version is missing core tables", async () => {
    vi.resetModules();
    const sqlite = await import("./mocks/expoSqlite");
    sqlite.resetExpoSqliteMock();

    let repaired = false;
    sqlite.mockDatabase.execAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS chapter_files")) repaired = true;
    });
    sqlite.mockDatabase.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("name = 'schema_version'")) return { name: "schema_version" };
      if (sql.includes("SELECT version FROM schema_version")) return { version: 8 };
      if (sql.includes("name = ?")) {
        const tableName = String(params?.[0] ?? "");
        if (!repaired && tableName === "chapter_files") return null;
        return { name: tableName };
      }
      if (sql.includes("SELECT COUNT(*) as count FROM books")) return { count: 0 };
      if (sql.includes("SELECT COUNT(*) as count FROM skills")) return { count: 0 };
      return null;
    });
    sqlite.mockDatabase.getAllAsync.mockImplementation(async () => []);

    const { loadLibraryState } = await import("../src/storage/sqliteRepository");

    await loadLibraryState();

    expect(sqlite.deleteDatabaseAsync).not.toHaveBeenCalled();
    expect(sqlite.mockDatabase.execAsync.mock.calls.some((call) => String(call[0]).includes("CREATE TABLE IF NOT EXISTS chapter_files"))).toBe(true);
    expect(sqlite.mockDatabase.getAllAsync.mock.calls.some((call) => String(call[0]).includes("FROM chapter_files"))).toBe(true);
  });

  it("retries the library read after SQLite reports a missing table", async () => {
    vi.resetModules();
    const sqlite = await import("./mocks/expoSqlite");
    sqlite.resetExpoSqliteMock();

    let repaired = false;
    sqlite.mockDatabase.execAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS chapter_files")) repaired = true;
    });
    sqlite.mockDatabase.getFirstAsync.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("name = 'schema_version'")) return { name: "schema_version" };
      if (sql.includes("SELECT version FROM schema_version")) return { version: 8 };
      if (sql.includes("name = ?")) return { name: String(params?.[0] ?? "") };
      if (sql.includes("SELECT COUNT(*) as count FROM books")) return { count: 0 };
      if (sql.includes("SELECT COUNT(*) as count FROM skills")) return { count: 0 };
      return null;
    });
    let chapterReadFailures = 0;
    sqlite.mockDatabase.getAllAsync.mockImplementation(async (sql: string) => {
      if (chapterReadFailures === 0 && sql.includes("FROM chapter_files")) {
        chapterReadFailures++;
        throw "Error code 1: no such table: main.chapter_files";
      }
      return [];
    });

    const { loadLibraryState } = await import("../src/storage/sqliteRepository");

    const state = await loadLibraryState();

    expect(state.books).toEqual([]);
    expect(sqlite.deleteDatabaseAsync).not.toHaveBeenCalled();
    expect(sqlite.mockDatabase.getAllAsync.mock.calls.filter((call) => String(call[0]).includes("FROM chapter_files")).length).toBe(2);
  });
});
