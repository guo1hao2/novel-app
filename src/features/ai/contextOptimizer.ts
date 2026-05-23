import type { ChatCompletionMessage } from "./promptBuilder";
import { LONG_FORM_WRITING_SYSTEM_PROMPT } from "./prompts";

const SYSTEM_PROMPT = LONG_FORM_WRITING_SYSTEM_PROMPT;

type ChapterSummaryEntry = {
  chapterId: string;
  title: string;
  summary: string;
  order: number;
};

type BuildOptimizedContextInput = {
  bookTitle: string;
  chapterTitle: string;
  worldbuilding: string;
  characters: string;
  plotOutline: string;
  chapterSummaries: ChapterSummaryEntry[];
  currentChapterContent: string;
  skillName: string;
  skillPrompt: string;
  userInstruction: string;
  previousDraft?: string;
};

const CHAR_TOKEN_RATIO = 1.5;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHAR_TOKEN_RATIO);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * CHAR_TOKEN_RATIO);
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

export function buildOptimizedContext(input: BuildOptimizedContextInput, tokenBudget = 32000): ChatCompletionMessage[] {
  const reserved = estimateTokens(SYSTEM_PROMPT) + estimateTokens(input.userInstruction) + estimateTokens(input.skillPrompt) + 500;
  let budget = tokenBudget - reserved;

  const sections: Array<{ priority: number; label: string; content: string }> = [];

  // Priority 1: Current chapter content (last N chars)
  const chapterBudget = Math.min(budget * 0.4, 6000);
  const chapterText = truncateToTokens(input.currentChapterContent, chapterBudget);
  sections.push({ priority: 1, label: "当前章节正文", content: chapterText });
  budget -= estimateTokens(chapterText);

  if (input.previousDraft?.trim()) {
    const draftText = truncateToTokens(input.previousDraft.trim(), Math.min(budget * 0.25, 2500));
    sections.push({ priority: 1.5, label: "上一版未确认草稿", content: draftText });
    budget -= estimateTokens(draftText);
  }

  // Priority 2: Recent chapter summaries (last 3-5)
  const recentSummaries = [...input.chapterSummaries]
    .sort((a, b) => b.order - a.order)
    .slice(0, 5)
    .reverse();
  const summaryBudget = Math.min(budget * 0.35, 4000);
  let usedSummaryBudget = 0;
  const summaryLines: string[] = [];
  for (const entry of recentSummaries) {
    if (!entry.summary) continue;
    const line = `${entry.title}：${entry.summary}`;
    const cost = estimateTokens(line);
    if (usedSummaryBudget + cost > summaryBudget) break;
    summaryLines.push(line);
    usedSummaryBudget += cost;
  }
  if (summaryLines.length) {
    sections.push({ priority: 2, label: "近期章节摘要", content: summaryLines.join("\n") });
    budget -= usedSummaryBudget;
  }

  // Priority 3: Characters
  if (input.characters.trim()) {
    const charsBudget = Math.min(budget * 0.4, 2000);
    const charsText = truncateToTokens(input.characters, charsBudget);
    sections.push({ priority: 3, label: "人物关系", content: charsText });
    budget -= estimateTokens(charsText);
  }

  // Priority 4: Plot outline
  if (input.plotOutline.trim()) {
    const outlineBudget = Math.min(budget * 0.35, 2000);
    const outlineText = truncateToTokens(input.plotOutline, outlineBudget);
    sections.push({ priority: 4, label: "章节大纲", content: outlineText });
    budget -= estimateTokens(outlineText);
  }

  // Priority 5: Worldbuilding
  if (input.worldbuilding.trim()) {
    const wbBudget = Math.min(budget * 0.5, 2000);
    const wbText = truncateToTokens(input.worldbuilding, wbBudget);
    sections.push({ priority: 5, label: "世界观", content: wbText });
    budget -= estimateTokens(wbText);
  }

  // Priority 6: Earlier summaries (fill remaining budget)
  const earlierSummaries = [...input.chapterSummaries]
    .sort((a, b) => b.order - a.order)
    .slice(5)
    .reverse();
  if (earlierSummaries.length && budget > 500) {
    const earlyLines: string[] = [];
    for (const entry of earlierSummaries) {
      if (!entry.summary) continue;
      const line = `${entry.title}：${entry.summary}`;
      const cost = estimateTokens(line);
      if (budget - cost < 200) break;
      earlyLines.push(line);
      budget -= cost;
    }
    if (earlyLines.length) {
      sections.push({ priority: 6, label: "更早章节摘要", content: earlyLines.join("\n") });
    }
  }

  const userParts: string[] = [
    `书本：${input.bookTitle}`,
    `当前章节：${input.chapterTitle}`,
    "",
    `当前 Skill：${input.skillName}`,
    input.skillPrompt,
    ""
  ];

  const sortedSections = [...sections].sort((a, b) => a.priority - b.priority);
  for (const section of sortedSections) {
    userParts.push(`【${section.label}】`);
    userParts.push(section.content);
    userParts.push("");
  }

  userParts.push("【用户指令】");
  userParts.push(input.userInstruction);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userParts.join("\n") }
  ];
}
