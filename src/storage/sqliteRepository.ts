import * as SQLite from "expo-sqlite";
import type { ApiProvider, Book, ChatMessage, ChapterFile, MaterialField, MaterialFile, MaterialKind, SkillAction, SkillTemplate, Volume } from "../types";
import { createDefaultSkills, normalizeSkillAction, type LibraryState } from "../features/library/localLibrary";
import { DEFAULT_PROVIDER } from "../features/settings/defaultProvider";
import { normalizeMaxTokens } from "../features/settings/maxTokens";
import { createSingleFlight, createWriteQueue } from "./storageGuards";
import { runMigrations } from "./migrations";
import { mapLegacyRowsToLibraryState } from "./legacyMigration";
import { normalizeSecureStoreKey } from "./secureApiKey";
import { loadWebLibraryState, saveWebLibraryState } from "./webLibraryMirror";

type BookRow = {
  id: string;
  title: string;
  summary: string;
  status: Book["status"];
  cover_color: string;
  created_at: string;
  updated_at: string;
};

type ChapterRow = {
  id: string;
  book_id: string;
  title: string;
  content: string;
  sort_order: number;
  summary: string;
  summary_updated_at: string;
  created_at: string;
  updated_at: string;
};

type VolumeRow = {
  id: string;
  book_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ChapterMetaRow = {
  id: string;
  book_id: string;
  volume_id: string;
  title: string;
  sort_order: number;
  summary: string;
  summary_updated_at: string;
  created_at: string;
  updated_at: string;
};

type MaterialRow = {
  id: string;
  book_id: string;
  kind: MaterialKind;
  title: string;
  content: string;
  fields: string;
  tags: string;
  created_at: string;
  updated_at: string;
};

type SkillRow = {
  id: string;
  name: string;
  prompt: string;
  action?: SkillAction;
  created_at: string;
  updated_at: string;
};

type ProviderRow = {
  id: string;
  name: string;
  vendor: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  api_key_storage_key: string;
};

type LegacyNovelRow = {
  id: string;
  title: string;
  summary: string;
  status: Book["status"];
  created_at: string;
  updated_at: string;
};

type LegacyManuscriptRow = {
  novel_id: string;
  content: string;
  updated_at: string;
};

type LegacySettingRow = {
  novel_id: string;
  worldbuilding: string;
  characters: string;
  chapter_summary: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
const enqueueWrite = createWriteQueue();

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync("novel_ai_writer.db");
  return databasePromise;
}

export async function resetDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise) {
    try {
      const db = await databasePromise;
      await db.closeAsync();
    } catch {}
  }
  databasePromise = null;
  await SQLite.deleteDatabaseAsync("novel_ai_writer.db");
  databasePromise = SQLite.openDatabaseAsync("novel_ai_writer.db");
  return databasePromise;
}

export const initializeDatabaseOnce = createSingleFlight(async () => {
  try {
    const database = await getDatabase();
    await runMigrations(database);
    await migrateLegacyTablesIfNeeded(database);
    await insertDefaultSkills(database);
    await insertDefaultProvider(database);
  } catch {
    databasePromise = null;
    const database = await resetDatabase();
    await runMigrations(database);
    await insertDefaultSkills(database);
    await insertDefaultProvider(database);
  }
  return true;
});

export async function loadLibraryState(): Promise<LibraryState> {
  await initializeDatabaseOnce();
  const database = await getDatabase();
  const [bookRows, volumeRows, chapterRows, materialRows, skillRows] = await Promise.all([
    database.getAllAsync<BookRow>("SELECT * FROM books ORDER BY updated_at DESC", []),
    database.getAllAsync<VolumeRow>("SELECT * FROM volumes ORDER BY sort_order ASC", []),
    database.getAllAsync<ChapterMetaRow>("SELECT id, book_id, volume_id, title, sort_order, summary, summary_updated_at, created_at, updated_at FROM chapter_files ORDER BY sort_order ASC", []),
    database.getAllAsync<MaterialRow>("SELECT * FROM material_files ORDER BY title ASC", []),
    database.getAllAsync<SkillRow>("SELECT * FROM skills ORDER BY created_at ASC", [])
  ]);

  const volumes: Record<string, Volume[]> = {};
  for (const row of volumeRows) {
    volumes[row.book_id] ??= [];
    volumes[row.book_id].push({
      id: row.id,
      bookId: row.book_id,
      title: row.title,
      order: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  const chapters: Record<string, ChapterFile[]> = {};
  for (const row of chapterRows) {
    chapters[row.book_id] ??= [];
    chapters[row.book_id].push({
      id: row.id,
      bookId: row.book_id,
      volumeId: row.volume_id,
      title: row.title,
      content: "",
      order: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isLoaded: false,
      summary: row.summary || undefined,
      summaryUpdatedAt: row.summary_updated_at || undefined
    });
  }

  const materials: Record<string, MaterialFile[]> = {};
  for (const row of materialRows) {
    materials[row.book_id] ??= [];
    materials[row.book_id].push({
      id: row.id,
      bookId: row.book_id,
      kind: row.kind,
      title: row.title,
      content: row.content,
      fields: parseJsonArray<MaterialField>(row.fields),
      tags: parseJsonArray<string>(row.tags),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  const state: LibraryState = {
    books: bookRows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    volumes,
    chapters,
    materials,
    skills: skillRows.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      action: normalizeSkillAction(row.action, row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };

  if (state.books.length) {
    saveWebLibraryState(state);
    return state;
  }

  const mirrored = loadWebLibraryState();
  if (mirrored?.books.length) {
    return {
      ...mirrored,
      skills: state.skills.length ? state.skills : mirrored.skills
    };
  }

  return state;
}

export async function saveLibraryState(state: LibraryState): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync("DELETE FROM chapter_files", []);
      await database.runAsync("DELETE FROM material_files", []);
      await database.runAsync("DELETE FROM volumes", []);
      await database.runAsync("DELETE FROM skills", []);
      await database.runAsync("DELETE FROM books", []);

      for (const book of state.books) {
        await database.runAsync(
          "INSERT INTO books (id, title, summary, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [book.id, book.title, book.summary, book.status, book.createdAt, book.updatedAt]
        );
      }

      for (const volume of Object.values(state.volumes).flat()) {
        await database.runAsync(
          "INSERT INTO volumes (id, book_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [volume.id, volume.bookId, volume.title, volume.order, volume.createdAt, volume.updatedAt]
        );
      }

      for (const chapter of Object.values(state.chapters).flat()) {
        await database.runAsync(
          "INSERT INTO chapter_files (id, book_id, volume_id, title, content, sort_order, summary, summary_updated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [chapter.id, chapter.bookId, chapter.volumeId ?? "", chapter.title, chapter.content, chapter.order, chapter.summary ?? "", chapter.summaryUpdatedAt ?? "", chapter.createdAt, chapter.updatedAt]
        );
      }

      for (const material of Object.values(state.materials).flat()) {
        await database.runAsync(
          "INSERT INTO material_files (id, book_id, kind, title, content, fields, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [material.id, material.bookId, material.kind, material.title, material.content, JSON.stringify(material.fields ?? []), JSON.stringify(material.tags ?? []), material.createdAt, material.updatedAt]
        );
      }

      for (const skill of state.skills) {
        await database.runAsync("INSERT INTO skills (id, name, prompt, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
          skill.id,
          skill.name,
          skill.prompt,
          normalizeSkillAction(skill.action, skill.id),
          skill.createdAt,
          skill.updatedAt
        ]);
      }
    });
  });
  saveWebLibraryState(state);
}

export async function loadProvider(): Promise<ApiProvider> {
  await initializeDatabaseOnce();
  const database = await getDatabase();
  const row = await database.getFirstAsync<ProviderRow>("SELECT * FROM api_providers WHERE is_active = 1", []);

  if (!row) {
    return DEFAULT_PROVIDER;
  }

  return {
    id: row.id,
    name: row.name,
    vendor: (row.vendor === "deepseek" || row.vendor === "openai") ? row.vendor : "deepseek",
    baseUrl: row.base_url,
    model: row.model,
    temperature: row.temperature,
    maxTokens: normalizeMaxTokens(row.max_tokens),
    apiKeyStorageKey: normalizeSecureStoreKey(row.api_key_storage_key)
  };
}

export async function loadAllProviders(): Promise<ApiProvider[]> {
  await initializeDatabaseOnce();
  const database = await getDatabase();
  const rows = await database.getAllAsync<ProviderRow & { is_active: number }>("SELECT * FROM api_providers ORDER BY rowid ASC", []);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    vendor: (row.vendor === "deepseek" || row.vendor === "openai") ? row.vendor : "deepseek",
    baseUrl: row.base_url,
    model: row.model,
    temperature: row.temperature,
    maxTokens: normalizeMaxTokens(row.max_tokens),
    apiKeyStorageKey: normalizeSecureStoreKey(row.api_key_storage_key),
    isActive: row.is_active === 1
  }));
}

export async function setActiveProvider(id: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync("UPDATE api_providers SET is_active = 0", []);
      await database.runAsync("UPDATE api_providers SET is_active = 1 WHERE id = ?", [id]);
    });
  });
}

export async function deleteProvider(id: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    const providerCount = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM api_providers", []);
    if ((providerCount?.count ?? 0) <= 1) {
      throw new Error("至少需要保留一个 Provider。");
    }
    await database.runAsync("DELETE FROM api_providers WHERE id = ?", [id]);
  });
}

export async function saveProvider(provider: ApiProvider): Promise<void> {
  await initializeDatabaseOnce();
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ is_active: number }>("SELECT is_active FROM api_providers WHERE id = ?", [
    provider.id
  ]);
  const normalizedProvider: ApiProvider = {
    ...provider,
    isActive: provider.isActive ?? existing?.is_active === 1,
    maxTokens: normalizeMaxTokens(provider.maxTokens),
    apiKeyStorageKey: normalizeSecureStoreKey(provider.apiKeyStorageKey)
  };

  await enqueueWrite(async () => {
    await database.runAsync(
      `INSERT OR REPLACE INTO api_providers
        (id, name, vendor, base_url, model, temperature, max_tokens, api_key_storage_key, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedProvider.id,
        normalizedProvider.name,
        normalizedProvider.vendor,
        normalizedProvider.baseUrl,
        normalizedProvider.model,
        normalizedProvider.temperature,
        normalizedProvider.maxTokens,
        normalizedProvider.apiKeyStorageKey,
        normalizedProvider.isActive ? 1 : 0
      ]
    );
  });
}

export async function appendChatMessage(message: ChatMessage): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync("INSERT INTO chat_messages (id, book_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)", [
      message.id,
      message.bookId,
      message.role,
      message.content,
      message.createdAt
    ]);
  });
}

async function migrateLegacyTablesIfNeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  const bookCount = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM books", []);
  if ((bookCount?.count ?? 0) > 0) return;
  if (!(await tableExists(database, "novels"))) return;

  const novelRows = await database.getAllAsync<LegacyNovelRow>("SELECT * FROM novels ORDER BY updated_at DESC", []);
  if (!novelRows.length) return;

  const manuscripts = (await tableExists(database, "manuscripts"))
    ? await database.getAllAsync<LegacyManuscriptRow>("SELECT * FROM manuscripts", [])
    : [];
  const settings = (await tableExists(database, "settings"))
    ? await database.getAllAsync<LegacySettingRow>("SELECT * FROM settings", [])
    : [];
  const skillRows = await database.getAllAsync<SkillRow>("SELECT * FROM skills ORDER BY created_at ASC", []);
  const migrated = mapLegacyRowsToLibraryState({
    novels: novelRows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    manuscripts: Object.fromEntries(
      manuscripts.map((row) => [
        row.novel_id,
        {
          novelId: row.novel_id,
          content: row.content,
          updatedAt: row.updated_at
        }
      ])
    ),
    settings: Object.fromEntries(
      settings.map((row) => [
        row.novel_id,
        {
          worldbuilding: row.worldbuilding,
          characters: row.characters,
          chapterSummary: row.chapter_summary
        }
      ])
    ),
    skills: skillRows.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      action: normalizeSkillAction(row.action, row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });

  await database.withTransactionAsync(async () => {
    for (const book of migrated.books) {
      await database.runAsync(
        "INSERT OR IGNORE INTO books (id, title, summary, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [book.id, book.title, book.summary, book.status, book.createdAt, book.updatedAt]
      );
    }
    for (const chapter of Object.values(migrated.chapters).flat()) {
      await database.runAsync(
        "INSERT OR IGNORE INTO chapter_files (id, book_id, title, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [chapter.id, chapter.bookId, chapter.title, chapter.content, chapter.order, chapter.createdAt, chapter.updatedAt]
      );
    }
    for (const material of Object.values(migrated.materials).flat()) {
      await database.runAsync(
        "INSERT OR IGNORE INTO material_files (id, book_id, kind, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [material.id, material.bookId, material.kind, material.title, material.content, material.createdAt, material.updatedAt]
      );
    }
  });
}

async function insertDefaultSkills(database: SQLite.SQLiteDatabase): Promise<void> {
  const skillCount = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM skills", []);
  if ((skillCount?.count ?? 0) > 0) return;
  for (const skill of createDefaultSkills()) {
    await database.runAsync("INSERT INTO skills (id, name, prompt, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
      skill.id,
      skill.name,
      skill.prompt,
      skill.action,
      skill.createdAt,
      skill.updatedAt
    ]);
  }
}

async function insertDefaultProvider(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO api_providers
      (id, name, vendor, base_url, model, temperature, max_tokens, api_key_storage_key, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      DEFAULT_PROVIDER.id,
      DEFAULT_PROVIDER.name,
      DEFAULT_PROVIDER.vendor,
      DEFAULT_PROVIDER.baseUrl,
      DEFAULT_PROVIDER.model,
      DEFAULT_PROVIDER.temperature,
      DEFAULT_PROVIDER.maxTokens,
      DEFAULT_PROVIDER.apiKeyStorageKey
    ]
  );
}

async function tableExists(database: SQLite.SQLiteDatabase, tableName: string): Promise<boolean> {
  const row = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return Boolean(row);
}

function parseJsonArray<T>(json: string | undefined | null): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
