import { createEmptyLibraryState, getBookChapters, getBookMaterials, type LibraryState } from "../features/library/localLibrary";
import type { Book, ChapterFile, MaterialFile, SkillTemplate } from "../types";

const WEB_LIBRARY_STATE_KEY = "novel-ai-writer.libraryState.v1";

export function loadWebLibraryState(): LibraryState | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(WEB_LIBRARY_STATE_KEY);
  if (!raw) return null;
  try {
    return normalizeLibraryState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveWebLibraryState(state: LibraryState): void {
  getStorage()?.setItem(WEB_LIBRARY_STATE_KEY, JSON.stringify(state));
}

export function upsertWebBook(book: Book): void {
  updateWebLibraryState((state) => ({
    ...state,
    books: [book, ...state.books.filter((item) => item.id !== book.id)],
    chapters: state.chapters[book.id] ? state.chapters : { ...state.chapters, [book.id]: [] },
    materials: state.materials[book.id] ? state.materials : { ...state.materials, [book.id]: [] }
  }));
}

export function deleteWebBook(bookId: string): void {
  updateWebLibraryState((state) => {
    const { [bookId]: _volumes, ...volumes } = state.volumes;
    const { [bookId]: _chapters, ...chapters } = state.chapters;
    const { [bookId]: _materials, ...materials } = state.materials;
    return {
      ...state,
      books: state.books.filter((book) => book.id !== bookId),
      volumes,
      chapters,
      materials
    };
  });
}

export function upsertWebChapter(chapter: ChapterFile): void {
  updateWebLibraryState((state) => ({
    ...state,
    chapters: {
      ...state.chapters,
      [chapter.bookId]: upsertById(getBookChapters(state, chapter.bookId), chapter).sort((a, b) => a.order - b.order)
    }
  }));
}

export function deleteWebChapter(chapterId: string): void {
  updateWebLibraryState((state) => ({
    ...state,
    chapters: Object.fromEntries(
      Object.entries(state.chapters).map(([bookId, chapters]) => [
        bookId,
        chapters.filter((chapter) => chapter.id !== chapterId)
      ])
    )
  }));
}

export function upsertWebMaterial(material: MaterialFile): void {
  updateWebLibraryState((state) => ({
    ...state,
    materials: {
      ...state.materials,
      [material.bookId]: upsertById(getBookMaterials(state, material.bookId), material)
    }
  }));
}

export function deleteWebMaterial(materialId: string): void {
  updateWebLibraryState((state) => ({
    ...state,
    materials: Object.fromEntries(
      Object.entries(state.materials).map(([bookId, materials]) => [
        bookId,
        materials.filter((material) => material.id !== materialId)
      ])
    )
  }));
}

export function upsertWebSkill(skill: SkillTemplate): void {
  updateWebLibraryState((state) => ({
    ...state,
    skills: upsertById(state.skills, skill)
  }));
}

function updateWebLibraryState(update: (state: LibraryState) => LibraryState): void {
  const current = loadWebLibraryState() ?? createEmptyLibraryState();
  saveWebLibraryState(update(current));
}

function normalizeLibraryState(value: unknown): LibraryState {
  const fallback = createEmptyLibraryState();
  if (!value || typeof value !== "object") return fallback;
  const maybeState = value as Partial<LibraryState>;
  return {
    books: Array.isArray(maybeState.books) ? maybeState.books : [],
    volumes: isRecord(maybeState.volumes) ? maybeState.volumes as LibraryState["volumes"] : {},
    chapters: isRecord(maybeState.chapters) ? maybeState.chapters as LibraryState["chapters"] : {},
    materials: isRecord(maybeState.materials) ? maybeState.materials as LibraryState["materials"] : {},
    skills: Array.isArray(maybeState.skills) ? maybeState.skills : fallback.skills
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getStorage(): Storage | undefined {
  if (typeof globalThis.localStorage === "undefined") return undefined;
  const storage = globalThis.localStorage as Partial<Storage>;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return undefined;
  return globalThis.localStorage;
}
