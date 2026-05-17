import { describe, expect, it } from "vitest";
import { mapLegacyRowsToLibraryState } from "../src/storage/legacyMigration";

describe("mapLegacyRowsToLibraryState", () => {
  it("migrates old novels, manuscripts, and settings into books, chapter files, and material files", () => {
    const migrated = mapLegacyRowsToLibraryState({
      novels: [
        {
          id: "novel-1",
          title: "Old Book",
          summary: "Old summary",
          status: "drafting",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      ],
      manuscripts: {
        "novel-1": {
          novelId: "novel-1",
          content: "Old manuscript",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }
      },
      settings: {
        "novel-1": {
          worldbuilding: "Old worldbuilding",
          characters: "Old characters",
          chapterSummary: "Old summary material"
        }
      },
      skills: []
    });

    expect(migrated.books[0]).toMatchObject({ id: "novel-1", title: "Old Book" });
    expect(migrated.chapters["novel-1"][0]).toMatchObject({ title: expect.any(String), content: "Old manuscript" });
    expect(migrated.materials["novel-1"].map((file) => [file.kind, file.content])).toEqual([
      ["worldbuilding", "Old worldbuilding"],
      ["characters", "Old characters"],
      ["plotOutline", ""],
      ["chapterSummary", "Old summary material"]
    ]);
  });
});
