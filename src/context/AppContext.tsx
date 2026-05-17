import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiProvider, ChatMessage, ChapterFile, MaterialFile, MaterialKind, SkillTemplate, Volume } from "../types";
import {
  appendToChapter,
  createBook,
  createChapter,
  createDefaultMaterials,
  createEmptyLibraryState,
  createVolume as createVolumePure,
  deleteBook as deleteBookFromLibrary,
  deleteVolume as deleteVolumePure,
  findChapter,
  findMaterial,
  getBookChapters,
  getBookMaterials,
  getBookVolumes,
  replaceChapterRange,
  updateBookStatus,
  updateBookSummary,
  updateBookTitle,
  updateChapterContent,
  updateChapterSummary as updateChapterSummaryPure,
  updateChapterTitle,
  updateMaterialFile,
  upsertSkill,
  type LibraryState
} from "../features/library/localLibrary";
import { DEFAULT_PROVIDER } from "../features/settings/defaultProvider";
import { appendChatMessage, deleteProvider as deleteProviderRepo, loadAllProviders, loadLibraryState, loadProvider, saveProvider, setActiveProvider as setActiveProviderRepo } from "../storage/sqliteRepository";
import { deleteBook as deleteBookPersist, deleteVolumePersist, loadChapterContent as fetchChapterContent, saveBook, saveChapter, saveMaterial, saveSkill, saveVolume as saveVolumePersist, updateChapterSummary as persistChapterSummary } from "../storage/incrementalRepository";
import {
  createInitialOnboardingConversation,
  type OnboardingConversation
} from "../features/ai/bookOnboarding";
import { generateChapterSummary as aiGenerateSummary } from "../features/ai/summarizer";
import { getApiKey, setApiKey } from "../storage/secureApiKey";

type NewBookInput = {
  title: string;
  summary: string;
  firstChapterContent?: string;
  materials?: Partial<Record<MaterialKind, string>>;
};

type TextSelection = {
  chapterId: string;
  start: number;
  end: number;
};

type AppContextValue = {
  apiKey: string;
  error: string;
  isReady: boolean;
  library: LibraryState;
  onboarding: OnboardingConversation;
  provider: ApiProvider;
  providers: ApiProvider[];
  selectedBookId: string;
  selectedChapterId: string;
  selectedMaterialId: string;
  chapterSelection: TextSelection;
  addBook: (input: NewBookInput) => Promise<string>;
  addChapter: (bookId: string, volumeId: string, title: string) => Promise<string>;
  addVolume: (bookId: string, title: string) => Promise<string>;
  appendAssistantText: (chapterId: string, content: string) => Promise<void>;
  clearError: () => void;
  deleteBook: (bookId: string) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  deleteVolume: (volumeId: string) => Promise<void>;
  generateChapterSummary: (chapterId: string) => Promise<void>;
  ensureBookMaterials: (bookId: string) => Promise<MaterialFile[]>;
  persistChatMessage: (message: ChatMessage) => Promise<void>;
  replaceSelectedChapterText: (chapterId: string, content: string) => Promise<void>;
  saveApiKey: (value: string) => Promise<void>;
  saveProviderConfig: (provider: ApiProvider) => Promise<void>;
  saveSkill: (skill: Pick<SkillTemplate, "id" | "name" | "prompt" | "action">) => Promise<void>;
  selectBook: (bookId: string) => void;
  selectChapter: (chapterId: string) => void;
  selectMaterial: (materialId: string) => void;
  setBookTitle: (bookId: string, title: string) => Promise<void>;
  setBookStatus: (bookId: string, status: "drafting" | "paused" | "finished") => Promise<void>;
  setChapterTitle: (chapterId: string, title: string) => Promise<void>;
  setBookSummary: (bookId: string, summary: string) => Promise<void>;
  setChapterContent: (chapterId: string, content: string) => Promise<void>;
  setChapterSelection: (chapterId: string, range: { start: number; end: number }) => void;
  setError: (message: string) => void;
  setBookMaterialContents: (bookId: string, updates: Partial<Record<MaterialKind, string>>) => Promise<MaterialFile[]>;
  setMaterialContent: (materialId: string, content: string) => Promise<void>;
  setOnboarding: (conversation: OnboardingConversation) => void;
  resetOnboarding: () => void;
  switchProvider: (id: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [error, setErrorState] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [library, setLibrary] = useState<LibraryState>(() => createEmptyLibraryState());
  const [provider, setProvider] = useState<ApiProvider>(DEFAULT_PROVIDER);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [chapterSelection, setSelection] = useState<TextSelection>({ chapterId: "", start: 0, end: 0 });
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingConversation>(() => createInitialOnboardingConversation());

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const [loadedLibrary, loadedProvider, allProviders] = await Promise.all([loadLibraryState(), loadProvider(), loadAllProviders()]);
        const loadedKey = await getApiKey(loadedProvider.apiKeyStorageKey);
        const firstBook = loadedLibrary.books[0];
        const firstChapter = firstBook ? getBookChapters(loadedLibrary, firstBook.id)[0] : undefined;
        const firstMaterial = firstBook ? getBookMaterials(loadedLibrary, firstBook.id)[0] : undefined;

        if (!isMounted) return;
        setLibrary(loadedLibrary);
        setProvider(loadedProvider);
        setApiKeyState(loadedKey);
        setSelectedBookId(firstBook?.id ?? "");
        setSelectedChapterId(firstChapter?.id ?? "");
        setSelectedMaterialId(firstMaterial?.id ?? "");
        setProviders(allProviders);
      } catch (caught) {
        if (isMounted) {
          setErrorState(caught instanceof Error ? caught.message : "本地数据初始化失败。");
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadChapterContent(chapterId: string) {
    const chapter = findChapter(library, chapterId);
    if (!chapter || chapter.isLoaded) return;
    const content = await fetchChapterContent(chapterId);
    setLibrary((prev) => ({
      ...prev,
      chapters: Object.fromEntries(
        Object.entries(prev.chapters).map(([bookId, files]) => [
          bookId,
          files.map((ch) => (ch.id === chapterId ? { ...ch, content, isLoaded: true } : ch))
        ])
      ) as Record<string, ChapterFile[]>
    }));
  }

  const value = useMemo<AppContextValue>(
    () => ({
      apiKey,
      error,
      isReady,
      library,
      onboarding,
      provider,
      providers,
      selectedBookId,
      selectedChapterId,
      selectedMaterialId,
      chapterSelection,
      deleteProvider: async (id: string) => {
        if (id === provider.id) {
          const fallback = providers.find((p) => p.id !== id);
          if (!fallback) return;
          await setActiveProviderRepo(fallback.id);
        }
        await deleteProviderRepo(id);
        const [activeProvider, updated] = await Promise.all([loadProvider(), loadAllProviders()]);
        const newKey = await getApiKey(activeProvider.apiKeyStorageKey);
        setProvider(activeProvider);
        setProviders(updated);
        setApiKeyState(newKey);
      },
      switchProvider: async (id: string) => {
        await setActiveProviderRepo(id);
        const [activeProvider, allProviders] = await Promise.all([loadProvider(), loadAllProviders()]);
        const newKey = await getApiKey(activeProvider.apiKeyStorageKey);
        setProvider(activeProvider);
        setProviders(allProviders);
        setApiKeyState(newKey);
      },
      addBook: async (input) => {
        const result = createBook(library, input);
        setLibrary(result.state);
        await Promise.all([
          saveBook(result.book),
          ...getBookVolumes(result.state, result.book.id).map((v) => saveVolumePersist(v)),
          ...getBookChapters(result.state, result.book.id).map((ch) => saveChapter(ch)),
          ...getBookMaterials(result.state, result.book.id).map((m) => saveMaterial(m))
        ]);
        const firstChapter = getBookChapters(result.state, result.book.id)[0];
        const firstMaterial = getBookMaterials(result.state, result.book.id)[0];
        setSelectedBookId(result.book.id);
        setSelectedChapterId(firstChapter?.id ?? "");
        setSelectedMaterialId(firstMaterial?.id ?? "");
        return result.book.id;
      },
      addChapter: async (bookId, volumeId, title) => {
        const result = createChapter(library, bookId, volumeId, title);
        setLibrary(result.state);
        await saveChapter(result.chapter);
        setSelectedBookId(bookId);
        setSelectedChapterId(result.chapter.id);
        return result.chapter.id;
      },
      addVolume: async (bookId, title) => {
        const result = createVolumePure(library, bookId, title);
        setLibrary(result.state);
        await saveVolumePersist(result.volume);
        return result.volume.id;
      },
      deleteVolume: async (volumeId) => {
        const next = deleteVolumePure(library, volumeId);
        setLibrary(next);
        await deleteVolumePersist(volumeId);
      },
      appendAssistantText: async (chapterId, content) => {
        const next = appendToChapter(library, chapterId, content);
        setLibrary(next);
        const updated = findChapter(next, chapterId);
        if (updated) await saveChapter(updated);
      },
      clearError: () => setErrorState(""),
      deleteBook: async (bookId: string) => {
        const next = deleteBookFromLibrary(library, bookId);
        setLibrary(next);
        await deleteBookPersist(bookId);
        if (selectedBookId === bookId) {
          const firstBook = next.books[0];
          const firstChapter = firstBook ? getBookChapters(next, firstBook.id)[0] : undefined;
          const firstMaterial = firstBook ? getBookMaterials(next, firstBook.id)[0] : undefined;
          setSelectedBookId(firstBook?.id ?? "");
          setSelectedChapterId(firstChapter?.id ?? "");
          setSelectedMaterialId(firstMaterial?.id ?? "");
        }
      },
      generateChapterSummary: async (chapterId) => {
        const chapter = findChapter(library, chapterId);
        if (!chapter) throw new Error("找不到指定章节。");
        const summary = await aiGenerateSummary({
          chapterTitle: chapter.title,
          chapterContent: chapter.content,
          provider: { baseUrl: provider.baseUrl, model: provider.model, temperature: provider.temperature, maxTokens: provider.maxTokens },
          apiKey
        });
        const next = updateChapterSummaryPure(library, chapterId, summary);
        setLibrary(next);
        await persistChapterSummary(chapterId, summary);
      },
      ensureBookMaterials: async (bookId) => {
        const existing = getBookMaterials(library, bookId);
        const defaults = createDefaultMaterials(bookId);
        const missing = defaults.filter((material) => !existing.some((item) => item.kind === material.kind));
        if (!missing.length) return existing;

        const nextMaterials = [...existing, ...missing];
        const next = {
          ...library,
          materials: {
            ...library.materials,
            [bookId]: nextMaterials
          }
        };
        setLibrary(next);
        await Promise.all(missing.map((material) => saveMaterial(material)));
        return nextMaterials;
      },
      persistChatMessage: async (message) => {
        await appendChatMessage(message);
      },
      replaceSelectedChapterText: async (chapterId, content) => {
        if (chapterSelection.chapterId !== chapterId || chapterSelection.start === chapterSelection.end) {
          throw new Error("请先在章节编辑器中选中要替换的文字。");
        }
        const next = replaceChapterRange(library, chapterId, chapterSelection, content);
        setLibrary(next);
        const updated = findChapter(next, chapterId);
        if (updated) await saveChapter(updated);
      },
      saveApiKey: async (valueToSave) => {
        await setApiKey(provider.apiKeyStorageKey, valueToSave);
        setApiKeyState(valueToSave.trim());
      },
      saveProviderConfig: async (nextProvider) => {
        await saveProvider(nextProvider);
        const [activeProvider, allProviders] = await Promise.all([loadProvider(), loadAllProviders()]);
        const newKey = await getApiKey(activeProvider.apiKeyStorageKey);
        setProvider(activeProvider);
        setProviders(allProviders);
        setApiKeyState(newKey);
      },
      saveSkill: async (skill) => {
        const next = upsertSkill(library, skill);
        setLibrary(next);
        const updated = next.skills.find((s) => s.id === skill.id);
        if (updated) await saveSkill(updated);
      },
      selectBook: (bookId) => {
        const firstChapter = getBookChapters(library, bookId)[0];
        const firstMaterial = getBookMaterials(library, bookId)[0];
        setSelectedBookId(bookId);
        setSelectedChapterId(firstChapter?.id ?? "");
        setSelectedMaterialId(firstMaterial?.id ?? "");
        if (firstChapter && !firstChapter.isLoaded) {
          void loadChapterContent(firstChapter.id);
        }
      },
      selectChapter: (chapterId: string) => {
        setSelectedChapterId(chapterId);
        const chapter = findChapter(library, chapterId);
        if (chapter && !chapter.isLoaded) {
          void loadChapterContent(chapterId);
        }
      },
      selectMaterial: setSelectedMaterialId,
      setBookTitle: async (bookId, title) => {
        const next = updateBookTitle(library, bookId, title);
        setLibrary(next);
        const updated = next.books.find((b) => b.id === bookId);
        if (updated) await saveBook(updated);
      },
      setBookStatus: async (bookId, status) => {
        const next = updateBookStatus(library, bookId, status);
        setLibrary(next);
        const updated = next.books.find((b) => b.id === bookId);
        if (updated) await saveBook(updated);
      },
      setChapterTitle: async (chapterId, title) => {
        const next = updateChapterTitle(library, chapterId, title);
        setLibrary(next);
        const updated = findChapter(next, chapterId);
        if (updated) await saveChapter(updated);
      },
      setBookSummary: async (bookId, summary) => {
        const next = updateBookSummary(library, bookId, summary);
        setLibrary(next);
        const updated = next.books.find((b) => b.id === bookId);
        if (updated) await saveBook(updated);
      },
      setChapterContent: async (chapterId, content) => {
        const next = updateChapterContent(library, chapterId, content);
        setLibrary(next);
        const updated = findChapter(next, chapterId);
        if (updated) await saveChapter(updated);
      },
      setChapterSelection: (chapterId, range) => {
        setSelection({ chapterId, start: range.start, end: range.end });
      },
      setError: setErrorState,
      setBookMaterialContents: async (bookId, updates) => {
        const existing = getBookMaterials(library, bookId);
        const defaults = createDefaultMaterials(bookId);
        const byKind = new Map<MaterialKind, MaterialFile>();
        for (const material of [...defaults, ...existing]) {
          byKind.set(material.kind, material);
        }
        const now = new Date().toISOString();
        const nextMaterials = Array.from(byKind.values()).map((material) =>
          Object.prototype.hasOwnProperty.call(updates, material.kind)
            ? { ...material, content: updates[material.kind]?.trim() ?? "", updatedAt: now }
            : material
        );
        const next = {
          ...library,
          materials: {
            ...library.materials,
            [bookId]: nextMaterials
          }
        };
        setLibrary((prev) => ({
          ...prev,
          materials: {
            ...prev.materials,
            [bookId]: nextMaterials
          }
        }));
        await Promise.all(nextMaterials.map((material) => saveMaterial(material)));
        return nextMaterials;
      },
      setMaterialContent: async (materialId, content) => {
        const next = updateMaterialFile(library, materialId, content);
        setLibrary(next);
        const updated = findMaterial(next, materialId);
        if (updated) await saveMaterial(updated);
      },
      setOnboarding,
      resetOnboarding: () => setOnboarding(createInitialOnboardingConversation())
    }),
    [
      apiKey,
      chapterSelection,
      error,
      isReady,
      library,
      onboarding,
      provider,
      providers,
      selectedBookId,
      selectedChapterId,
      selectedMaterialId
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}

export function getSelectedBookData(library: LibraryState, selectedBookId: string, selectedChapterId: string, selectedMaterialId: string) {
  const book = library.books.find((item) => item.id === selectedBookId);
  const volumes = book ? getBookVolumes(library, book.id) : [];
  const chapters = book ? getBookChapters(library, book.id) : [];
  const materials = book ? getBookMaterials(library, book.id) : [];
  const chapter = findChapter(library, selectedChapterId) ?? chapters[0];
  const material = findMaterial(library, selectedMaterialId) ?? materials[0];

  return { book, volumes, chapters, materials, chapter, material };
}
