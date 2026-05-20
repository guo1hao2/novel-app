import type { SQLiteDatabase } from "expo-sqlite";

type Migration = {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "initial schema",
    up: async (db) => {
      try { await db.execAsync("PRAGMA journal_mode = WAL;"); } catch {}
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chapter_files (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS material_files (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          fields TEXT NOT NULL DEFAULT '[]',
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          prompt TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS api_providers (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          model TEXT NOT NULL,
          temperature REAL NOT NULL,
          max_tokens INTEGER NOT NULL,
          api_key_storage_key TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY NOT NULL
        );
      `);
    }
  },
  {
    version: 2,
    description: "add indexes on book_id foreign keys",
    up: async (db) => {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_chapter_files_book_id ON chapter_files(book_id);
        CREATE INDEX IF NOT EXISTS idx_material_files_book_id ON material_files(book_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_book_id ON chat_messages(book_id);
        CREATE INDEX IF NOT EXISTS idx_chapter_files_sort ON chapter_files(book_id, sort_order);
      `);
    }
  },
  {
    version: 3,
    description: "add chapter summary columns",
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE chapter_files ADD COLUMN summary TEXT NOT NULL DEFAULT '';
        ALTER TABLE chapter_files ADD COLUMN summary_updated_at TEXT NOT NULL DEFAULT '';
      `);
    }
  },
  {
    version: 4,
    description: "add is_active column to api_providers for multi-provider support",
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE api_providers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;
      `);
      await db.runAsync(
        "UPDATE api_providers SET is_active = 1 WHERE id = ?",
        ["deepseek"]
      );
    }
  },
  {
    version: 5,
    description: "add action column to skills",
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE skills ADD COLUMN action TEXT NOT NULL DEFAULT 'appendText';
      `);
      await db.runAsync("UPDATE skills SET action = ? WHERE id = ?", ["appendText", "continue-writing"]);
      await db.runAsync("UPDATE skills SET action = ? WHERE id = ?", ["replaceSelection", "rewrite-polish"]);
      await db.runAsync("UPDATE skills SET action = ? WHERE id = ?", ["chatOnly", "summarize-chapter"]);
      await db.runAsync("UPDATE skills SET action = ? WHERE id = ?", ["updateMaterials", "expand-setting"]);
    }
  },
  {
    version: 6,
    description: "add cover_color column to books",
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE books ADD COLUMN cover_color TEXT NOT NULL DEFAULT '';
      `);
    }
  },
  {
    version: 7,
    description: "add volumes table and volume_id to chapter_files",
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS volumes (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL,
          title TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_volumes_book_id ON volumes(book_id);
        ALTER TABLE chapter_files ADD COLUMN volume_id TEXT NOT NULL DEFAULT '';
      `);
      const bookRows = await db.getAllAsync<{ id: string }>("SELECT id FROM books", []);
      const now = new Date().toISOString();
      for (const book of bookRows) {
        const volumeId = `volume-${book.id}-1`;
        await db.runAsync(
          "INSERT INTO volumes (id, book_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          [volumeId, book.id, "第一卷", 1, now, now]
        );
        await db.runAsync(
          "UPDATE chapter_files SET volume_id = ? WHERE book_id = ?",
          [volumeId, book.id]
        );
      }
    }
  },
  {
    version: 8,
    description: "add vendor column to api_providers",
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE api_providers ADD COLUMN vendor TEXT NOT NULL DEFAULT 'deepseek';
      `);
      await db.runAsync(
        "UPDATE api_providers SET vendor = 'deepseek' WHERE base_url LIKE '%deepseek%'"
      );
      await db.runAsync(
        "UPDATE api_providers SET vendor = 'openai' WHERE base_url NOT LIKE '%deepseek%'"
      );
    }
  },
  {
    version: 9,
    description: "add conversations table and conversation_id to chat_messages",
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_conversations_book_id ON conversations(book_id);
      `);
      try {
        await db.execAsync(`
          ALTER TABLE chat_messages ADD COLUMN conversation_id TEXT NOT NULL DEFAULT '';
        `);
      } catch {
        // Column may already exist
      }
      // Migrate existing messages: create default conversation for each book
      const bookRows = await db.getAllAsync<{ book_id: string }>(
        "SELECT DISTINCT book_id FROM chat_messages WHERE conversation_id = '' OR conversation_id IS NULL",
        []
      );
      const now = new Date().toISOString();
      for (const book of bookRows) {
        const conversationId = `conv-default-${book.book_id}`;
        await db.runAsync(
          "INSERT INTO conversations (id, book_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          [conversationId, book.book_id, "默认对话", now, now]
        );
        await db.runAsync(
          "UPDATE chat_messages SET conversation_id = ? WHERE book_id = ?",
          [conversationId, book.book_id]
        );
      }
    }
  }
];

export async function runMigrations(db: SQLiteDatabase): Promise<number> {
  const currentVersion = await getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

  for (const migration of pending) {
    await migration.up(db);
    await db.runAsync("INSERT OR REPLACE INTO schema_version (version) VALUES (?)", [migration.version]);
  }

  return pending.length ? pending[pending.length - 1].version : currentVersion;
}

export function getLatestVersion(): number {
  return MIGRATIONS[MIGRATIONS.length - 1].version;
}

async function getCurrentVersion(db: SQLiteDatabase): Promise<number> {
  const hasTable = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'",
    []
  );
  if (!hasTable) return 0;

  const row = await db.getFirstAsync<{ version: number }>("SELECT version FROM schema_version", []);
  return row?.version ?? 0;
}
