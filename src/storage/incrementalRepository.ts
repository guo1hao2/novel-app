import type { Book, ChapterFile, MaterialFile, SkillTemplate, Volume } from "../types";
import { normalizeSkillAction } from "../features/library/localLibrary";
import { getDatabase, initializeDatabaseOnce } from "./sqliteRepository";
import { createWriteQueue } from "./storageGuards";
import {
  deleteWebBook,
  deleteWebChapter,
  deleteWebMaterial,
  upsertWebBook,
  upsertWebChapter,
  upsertWebMaterial,
  upsertWebSkill
} from "./webLibraryMirror";

const enqueueWrite = createWriteQueue();

export async function saveBook(book: Book): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO books (id, title, summary, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [book.id, book.title, book.summary, book.status, book.createdAt, book.updatedAt]
    );
  });
  upsertWebBook(book);
}

export async function deleteBook(bookId: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync("DELETE FROM chapter_files WHERE book_id = ?", [bookId]);
      await database.runAsync("DELETE FROM material_files WHERE book_id = ?", [bookId]);
      await database.runAsync("DELETE FROM volumes WHERE book_id = ?", [bookId]);
      await database.runAsync("DELETE FROM books WHERE id = ?", [bookId]);
    });
  });
  deleteWebBook(bookId);
}

export async function saveChapter(chapter: ChapterFile): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO chapter_files (id, book_id, volume_id, title, content, sort_order, summary, summary_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chapter.id,
        chapter.bookId,
        chapter.volumeId,
        chapter.title,
        chapter.content,
        chapter.order,
        chapter.summary ?? "",
        chapter.summaryUpdatedAt ?? "",
        chapter.createdAt,
        chapter.updatedAt
      ]
    );
  });
  upsertWebChapter(chapter);
}

export async function saveVolume(volume: Volume): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO volumes (id, book_id, title, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [volume.id, volume.bookId, volume.title, volume.order, volume.createdAt, volume.updatedAt]
    );
  });
}

export async function deleteVolumePersist(volumeId: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync("DELETE FROM chapter_files WHERE volume_id = ?", [volumeId]);
      await database.runAsync("DELETE FROM volumes WHERE id = ?", [volumeId]);
    });
  });
}

export async function deleteChapter(chapterId: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM chapter_files WHERE id = ?", [chapterId]);
  });
  deleteWebChapter(chapterId);
}

export async function saveMaterial(material: MaterialFile): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO material_files (id, book_id, kind, title, content, fields, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        material.id,
        material.bookId,
        material.kind,
        material.title,
        material.content,
        JSON.stringify(material.fields ?? []),
        JSON.stringify(material.tags ?? []),
        material.createdAt,
        material.updatedAt
      ]
    );
  });
  upsertWebMaterial(material);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM material_files WHERE id = ?", [materialId]);
  });
  deleteWebMaterial(materialId);
}

export async function saveSkill(skill: SkillTemplate): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR REPLACE INTO skills (id, name, prompt, action, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [skill.id, skill.name, skill.prompt, normalizeSkillAction(skill.action, skill.id), skill.createdAt, skill.updatedAt]
    );
  });
  upsertWebSkill({ ...skill, action: normalizeSkillAction(skill.action, skill.id) });
}

export async function updateChapterSummary(chapterId: string, summary: string): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    const updatedAt = new Date().toISOString();
    await database.runAsync(
      "UPDATE chapter_files SET summary = ?, summary_updated_at = ? WHERE id = ?",
      [summary, updatedAt, chapterId]
    );
  });
}

export async function loadChapterContent(chapterId: string): Promise<string> {
  await initializeDatabaseOnce();
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ content: string }>(
    "SELECT content FROM chapter_files WHERE id = ?",
    [chapterId]
  );
  return row?.content ?? "";
}

export async function reorderChapters(bookId: string, chapterIds: string[]): Promise<void> {
  await initializeDatabaseOnce();
  await enqueueWrite(async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      for (let i = 0; i < chapterIds.length; i++) {
        await database.runAsync("UPDATE chapter_files SET sort_order = ? WHERE id = ?", [i + 1, chapterIds[i]]);
      }
    });
  });
}
