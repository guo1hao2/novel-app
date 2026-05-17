import { requestChatCompletion } from "./apiClient";

type GenerateArcInput = {
  bookTitle: string;
  chapterSummaries: Array<{ title: string; summary: string; order: number }>;
  provider: {
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  apiKey: string;
  fetcher?: typeof fetch;
};

const ARC_SYSTEM_PROMPT = [
  "你是一个专业的中文长篇小说叙事分析师。",
  "用户会提供一本书各章节的摘要。请基于这些摘要，生成一份结构化的叙事状态报告。",
  "报告应包含以下部分：",
  "1. 已完成的主线剧情",
  "2. 进行中的情节线（含涉及的人物和当前状态）",
  "3. 未解决的伏笔或悬念",
  "4. 已出场的主要人物及其最新状态",
  "请用简洁的中文输出，每部分用标题分隔，总字数控制在 800 字以内。"
].join("\n");

export async function generateStoryArc(input: GenerateArcInput): Promise<string> {
  const summaryText = input.chapterSummaries
    .sort((a, b) => a.order - b.order)
    .map((ch, i) => `${i + 1}. ${ch.title}：${ch.summary || "无摘要"}`)
    .join("\n");

  const messages = [
    { role: "system" as const, content: ARC_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `书本：${input.bookTitle}\n\n以下是各章节摘要：\n\n${summaryText}`
    }
  ];

  return requestChatCompletion({
    provider: input.provider,
    apiKey: input.apiKey,
    messages,
    fetcher: input.fetcher
  });
}
