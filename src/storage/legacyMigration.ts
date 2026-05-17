import type { LegacyManuscript, LegacyNovel, LegacySettingDocument, SkillTemplate } from "../types";
import { createDefaultMaterials, createDefaultSkills, type LibraryState } from "../features/library/localLibrary";

type LegacyLibraryState = {
  novels: LegacyNovel[];
  manuscripts: Record<string, LegacyManuscript>;
  settings: Record<string, LegacySettingDocument>;
  skills: SkillTemplate[];
};

export function mapLegacyRowsToLibraryState(legacy: LegacyLibraryState): LibraryState {
  const state: LibraryState = {
    books: legacy.novels.map((novel) => ({
      id: novel.id,
      title: novel.title,
      summary: novel.summary,
      status: novel.status,
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt
    })),
    volumes: {},
    chapters: {},
    materials: {},
    skills: legacy.skills.length ? legacy.skills : createDefaultSkills()
  };

  for (const novel of legacy.novels) {
    const timestamp = legacy.manuscripts[novel.id]?.updatedAt ?? novel.updatedAt;
    const defaultVolumeId = `volume-${novel.id}-1`;
    state.volumes[novel.id] = [
      {
        id: defaultVolumeId,
        bookId: novel.id,
        title: "第一卷",
        order: 1,
        createdAt: novel.createdAt,
        updatedAt: novel.updatedAt
      }
    ];
    state.chapters[novel.id] = [
      {
        id: `${novel.id}-chapter-1`,
        bookId: novel.id,
        volumeId: defaultVolumeId,
        title: "第一章",
        content: legacy.manuscripts[novel.id]?.content ?? "",
        order: 1,
        createdAt: novel.createdAt,
        updatedAt: timestamp
      }
    ];

    const defaultMaterials = createDefaultMaterials(novel.id, novel.updatedAt);
    const legacySettings = legacy.settings[novel.id];
    state.materials[novel.id] = defaultMaterials.map((file) => ({
      ...file,
      content: (legacySettings as Record<string, string> | undefined)?.[file.kind] ?? "",
      updatedAt: novel.updatedAt
    }));
  }

  return state;
}
