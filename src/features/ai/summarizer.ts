import { requestChatCompletion } from "./apiClient";
import type { ChatCompletionMessage } from "./promptBuilder";

type ProviderRuntimeConfig = {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

type GenerateChapterSummaryInput = {
  chapterTitle: string;
  chapterContent: string;
  provider: ProviderRuntimeConfig;
  apiKey: string;
  fetcher?: typeof fetch;
};

const SUMMARY_SYSTEM_PROMPT = [
  "你是一个专业的中文小说编辑助手。你的任务是为小说章节生成简洁、准确的摘要。",
  "要求：",
  "1. 摘要长度控制在 200-400 个中文字符之间。",
  "2. 必须保留以下关键信息：",
  "   - 章节中发生的关键事件和剧情推进",
  "   - 人物状态变化（情感、关系、位置等）",
  "   - 重要的伏笔和悬念",
  "   - 关键对话的核心内容",
  "3. 使用客观、简洁的叙述语言，不要加入主观评价。",
  "4. 只输出摘要正文，不要输出任何额外说明或标记。"
].join("\n");

export async function generateChapterSummary(input: GenerateChapterSummaryInput): Promise<string> {
  if (!input.chapterContent.trim()) {
    throw new Error("章节内容为空，无法生成摘要。");
  }

  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: SUMMARY_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: `请为以下章节生成摘要：\n\n章节标题：${input.chapterTitle}\n\n章节正文：\n${input.chapterContent}`
    }
  ];

  return requestChatCompletion({
    provider: {
      baseUrl: input.provider.baseUrl,
      model: input.provider.model,
      temperature: 0.3,
      maxTokens: 1024
    },
    apiKey: input.apiKey,
    messages,
    fetcher: input.fetcher
  });
}
