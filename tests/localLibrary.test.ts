import { describe, expect, it } from "vitest";
import {
  appendToChapter,
  createBook,
  createChapter,
  createEmptyLibraryState,
  getBookMaterials,
  replaceChapterRange,
  updateChapterContent,
  updateMaterialFile
} from "../src/features/library/localLibrary";

describe("book library helpers", () => {
  it("creates a book with a default chapter and four fixed material files", () => {
    const result = createBook(createEmptyLibraryState(), {
      title: "Moon City",
      summary: "A city under an endless night."
    });

    expect(result.state.books).toHaveLength(1);
    expect(result.book.title).toBe("Moon City");
    expect(result.state.chapters[result.book.id]).toMatchObject([
      {
        bookId: result.book.id,
        title: expect.any(String),
        content: "",
        order: 1
      }
    ]);
    expect(getBookMaterials(result.state, result.book.id).map((file) => file.kind)).toEqual([
      "worldbuilding",
      "characters",
      "plotOutline",
      "chapterSummary"
    ]);
  });

  it("assigns fixed actions to default writing skills", () => {
    const state = createEmptyLibraryState();

    expect(state.skills.map((skill) => ({ id: skill.id, action: skill.action }))).toEqual([
      { id: "continue-writing", action: "appendText" },
      { id: "dialogue-generation", action: "appendText" },
      { id: "scene-description", action: "appendText" },
      { id: "action-scene", action: "appendText" },
      { id: "inner-monologue", action: "appendText" },
      { id: "rewrite-polish", action: "replaceSelection" },
      { id: "condense-text", action: "replaceSelection" },
      { id: "expand-detail", action: "replaceSelection" },
      { id: "summarize-chapter", action: "chatOnly" },
      { id: "pacing-check", action: "chatOnly" },
      { id: "consistency-check", action: "chatOnly" },
      { id: "expand-setting", action: "updateMaterials" },
      { id: "character-profile", action: "updateMaterials" }
    ]);
  });

  it("creates a book with onboarding material content when provided", () => {
    const result = createBook(createEmptyLibraryState(), {
      title: "Star Tide",
      summary: "A mystery adventure in a sea city.",
      materials: {
        worldbuilding: "Genre: mystery adventure\nStyle: cold poetic",
        characters: "Lin Chao: an amnesiac lighthouse keeper.",
        plotOutline: "Chapter 1: the tide list disappears.",
        chapterSummary: "Chapter one reveals the missing-name list."
      }
    });

    const materials = getBookMaterials(result.state, result.book.id);

    expect(materials.find((file) => file.kind === "worldbuilding")?.content).toContain("mystery adventure");
    expect(materials.find((file) => file.kind === "characters")?.content).toContain("Lin Chao");
    expect(materials.find((file) => file.kind === "plotOutline")?.content).toContain("Chapter 1");
    expect(materials.find((file) => file.kind === "chapterSummary")?.content).toContain("Chapter one");
  });

  it("preserves rich onboarding material sections without changing default material kinds", () => {
    const result = createBook(createEmptyLibraryState(), {
      title: "霓虹回声",
      summary: "夜班急救员在事故现场听见未来凶案。",
      materials: {
        worldbuilding: "【世界规则】近未来城市由企业监管异能。\n【能力体系】异能会留下情绪回声。",
        characters: "【主角能力】能听见物品残留情绪。\n【动机】查清未来凶案。",
        plotOutline: "【第一卷主线】追查事故背后的企业实验。\n1. 事故现场\n2. 追踪信号\n3. 企业档案",
        chapterSummary: "【第一章目标】救人时发现能力被追踪。\n【开篇钩子】未来凶案的声音来自死者手机。"
      }
    });

    const materials = getBookMaterials(result.state, result.book.id);

    expect(materials.map((file) => file.kind)).toEqual([
      "worldbuilding",
      "characters",
      "plotOutline",
      "chapterSummary"
    ]);
    expect(materials.find((file) => file.kind === "worldbuilding")?.content).toContain("【能力体系】");
    expect(materials.find((file) => file.kind === "characters")?.content).toContain("【主角能力】");
    expect(materials.find((file) => file.kind === "plotOutline")?.content).toContain("【第一卷主线】");
    expect(materials.find((file) => file.kind === "chapterSummary")?.content).toContain("【开篇钩子】");
  });

  it("updates material files and appends AI output to the selected chapter", () => {
    const created = createBook(createEmptyLibraryState(), {
      title: "Moon City",
      summary: ""
    });
    const chapterId = created.state.chapters[created.book.id][0].id;
    const materialId = getBookMaterials(created.state, created.book.id).find((file) => file.kind === "characters")?.id ?? "";

    const withMaterial = updateMaterialFile(created.state, materialId, "Shen Deng: night keeper.");
    const withText = appendToChapter(withMaterial, chapterId, "First paragraph.");
    const withMoreText = appendToChapter(withText, chapterId, "Second paragraph.");

    expect(getBookMaterials(withMoreText, created.book.id).find((file) => file.kind === "characters")?.content).toBe("Shen Deng: night keeper.");
    expect(withMoreText.chapters[created.book.id][0].content).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("creates additional chapters with stable order and replaces only the selected range", () => {
    const created = createBook(createEmptyLibraryState(), {
      title: "Moon City",
      summary: ""
    });
    const defaultVolumeId = created.state.volumes[created.book.id]?.[0]?.id ?? "";
    const withSecondChapter = createChapter(created.state, created.book.id, defaultVolumeId, "Chapter 2");
    const secondChapter = withSecondChapter.state.chapters[created.book.id][1];
    const withText = updateChapterContent(withSecondChapter.state, secondChapter.id, "Outside the door, the wind moved the lamp.");
    const replaced = replaceChapterRange(withText, secondChapter.id, { start: 18, end: 22 }, "rain");

    expect(secondChapter.order).toBe(2);
    expect(replaced.chapters[created.book.id][1].content).toBe("Outside the door, rainwind moved the lamp.");
  });
});
