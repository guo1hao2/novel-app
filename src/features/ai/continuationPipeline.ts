import type { ChatCompletionMessage } from "./promptBuilder";
import { LONG_FORM_WRITING_SYSTEM_PROMPT, MATERIAL_LIBRARY_UPDATE_SYSTEM_PROMPT } from "./prompts";

type ContinuationBaseInput = {
  bookTitle: string;
  chapterTitle: string;
  worldbuilding: string;
  characters: string;
  plotOutline: string;
  chapterSummary: string;
  userInstruction: string;
};

export type ContinuationMaterialInput = ContinuationBaseInput & {
  confirmedChapterContent: string;
};

export type ContinuationDraftInput = ContinuationBaseInput & {
  currentChapterContent: string;
  skillName: string;
  skillPrompt: string;
  previousDraft?: string;
};

export type MaterialUpdateResult = {
  worldbuilding: string;
  characters: string;
  plotOutline: string;
  chapterSummary: string;
};

export function buildMaterialUpdateMessages(input: ContinuationMaterialInput): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content: MATERIAL_LIBRARY_UPDATE_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        `bookTitle: ${input.bookTitle}`,
        `chapterTitle: ${input.chapterTitle}`,
        `worldbuilding: ${input.worldbuilding || "暂无"}`,
        `characters: ${input.characters || "暂无"}`,
        `plotOutline: ${input.plotOutline || "暂无"}`,
        `chapterSummary: ${input.chapterSummary || "暂无"}`,
        `confirmedChapterContent: ${input.confirmedChapterContent || "暂无"}`,
        `userInstruction: ${input.userInstruction}`
      ].join("\n\n")
    }
  ];
}

export function buildContinuationDraftMessages(input: ContinuationDraftInput): ChatCompletionMessage[] {
  const previousDraftBlock = input.previousDraft?.trim()
    ? [`previousDraft: ${input.previousDraft.trim()}`, "用户没有确认上一版草稿，请基于 previousDraft 按最新指令修改，不要忽略它。"]
    : [];

  return [
    {
      role: "system",
      content: LONG_FORM_WRITING_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: [
        `bookTitle: ${input.bookTitle}`,
        `chapterTitle: ${input.chapterTitle}`,
        `skillName: ${input.skillName}`,
        `skillPrompt: ${input.skillPrompt}`,
        `worldbuilding: ${input.worldbuilding || "暂无"}`,
        `characters: ${input.characters || "暂无"}`,
        `plotOutline: ${input.plotOutline || "暂无"}`,
        `chapterSummary: ${input.chapterSummary || "暂无"}`,
        `currentChapterContent: ${input.currentChapterContent || "暂无"}`,
        ...previousDraftBlock,
        `userInstruction: ${input.userInstruction}`
      ].join("\n\n")
    }
  ];
}

export function parseMaterialUpdateResult(raw: string): MaterialUpdateResult {
  const parsed = parseJsonObject(raw);
  const result = {
    worldbuilding: asText(parsed.worldbuilding),
    characters: asText(parsed.characters),
    plotOutline: asText(parsed.plotOutline),
    chapterSummary: asText(parsed.chapterSummary)
  };

  if (!result.worldbuilding || !result.characters || !result.plotOutline || !result.chapterSummary) {
    throw new Error("AI returned incomplete material updates.");
  }

  return result;
}

function parseJsonObject(raw: string): Record<string, any> {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("AI returned invalid material update JSON.");
  }

  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("AI material update JSON must be an object.");
    }
    return parsed;
  } catch {
    throw new Error("AI returned invalid material update JSON.");
  }
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
