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
    return null;
  });
  db.getAllAsync.mockImplementation(async () => []);
}

async function loadRepositories() {
  vi.resetModules();
  const sqlite = await import("./mocks/expoSqlite");
  sqlite.resetExpoSqliteMock();
  mockInitializedDatabase(sqlite.mockDatabase);
  const sqliteRepository = await import("../src/storage/sqliteRepository");
  const incrementalRepository = await import("../src/storage/incrementalRepository");
  return { ...sqliteRepository, ...incrementalRepository, db: sqlite.mockDatabase };
}

describe("skill storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads legacy skills without an action using default action mapping", async () => {
    const { db, loadLibraryState } = await loadRepositories();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM books")) return [];
      if (sql.includes("FROM chapter_files")) return [];
      if (sql.includes("FROM material_files")) return [];
      if (sql.includes("FROM skills")) {
        return [
          {
            id: "rewrite-polish",
            name: "润色",
            prompt: "Polish prose.",
            created_at: "2026-05-16T00:00:00.000Z",
            updated_at: "2026-05-16T00:00:00.000Z"
          },
          {
            id: "custom",
            name: "Custom",
            prompt: "Do something.",
            created_at: "2026-05-16T00:00:00.000Z",
            updated_at: "2026-05-16T00:00:00.000Z"
          }
        ];
      }
      return [];
    });

    const state = await loadLibraryState();

    expect(state.skills.map((skill) => ({ id: skill.id, action: skill.action }))).toEqual([
      { id: "rewrite-polish", action: "replaceSelection" },
      { id: "custom", action: "appendText" }
    ]);
  });

  it("persists skill actions when saving a skill", async () => {
    const { db, saveSkill } = await loadRepositories();

    await saveSkill({
      id: "expand-setting",
      name: "补全资料",
      prompt: "Extract material updates.",
      action: "updateMaterials",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z"
    });

    const saveCall = db.runAsync.mock.calls.find((call: unknown[]) => String(call[0]).includes("INSERT OR REPLACE INTO skills"));
    expect(String(saveCall?.[0])).toContain("action");
    expect(saveCall?.[1]).toEqual([
      "expand-setting",
      "补全资料",
      "Extract material updates.",
      "updateMaterials",
      "2026-05-16T00:00:00.000Z",
      "2026-05-16T00:00:00.000Z"
    ]);
  });
});
