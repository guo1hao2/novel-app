export type MaterialKind =
  | "worldbuilding"
  | "characters"
  | "chapterSummary"
  | "characterProfile"
  | "location"
  | "timeline"
  | "magicSystem"
  | "plotOutline"
  | "vocabulary"
  | "custom";

export type BookStatus = "drafting" | "paused" | "finished";

export type SkillAction = "appendText" | "replaceSelection" | "updateMaterials" | "chatOnly";

export type Book = {
  id: string;
  title: string;
  summary: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
};

export type Volume = {
  id: string;
  bookId: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type ChapterFile = {
  id: string;
  bookId: string;
  volumeId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  isLoaded?: boolean;
  summary?: string;
  summaryUpdatedAt?: string;
};

export type MaterialField = {
  key: string;
  label: string;
  type: "text" | "multiline" | "tags" | "number";
  value: string;
};

export type MaterialFile = {
  id: string;
  bookId: string;
  kind: MaterialKind;
  title: string;
  content: string;
  fields?: MaterialField[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type SkillTemplate = {
  id: string;
  name: string;
  prompt: string;
  action: SkillAction;
  createdAt: string;
  updatedAt: string;
};

export type ApiVendor = "deepseek" | "openai";

export type ApiProvider = {
  id: string;
  name: string;
  vendor: ApiVendor;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKeyStorageKey: string;
  isActive?: boolean;
};

export type ChatMessage = {
  id: string;
  bookId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type LegacyNovelStatus = "drafting" | "paused" | "finished";

export type LegacyNovel = {
  id: string;
  title: string;
  summary: string;
  status: LegacyNovelStatus;
  createdAt: string;
  updatedAt: string;
};

export type LegacyManuscript = {
  novelId: string;
  content: string;
  updatedAt: string;
};

export type LegacySettingDocument = {
  worldbuilding: string;
  characters: string;
  chapterSummary: string;
};
