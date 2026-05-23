export type ChatRole = "system" | "user" | "assistant";

export type ChatCompletionMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  max_tokens: number;
  stream?: boolean;
};

export type WritingSkillInput = {
  name: string;
  prompt: string;
};

export type BookContextInput = {
  worldbuilding: string;
  characters: string;
  chapterSummary: string;
  chapterContent: string;
};

export type BuildChatCompletionRequestInput = {
  model: string;
  temperature: number;
  maxTokens: number;
  bookTitle: string;
  chapterTitle?: string;
  skill: WritingSkillInput;
  context: BookContextInput;
  userInstruction: string;
};

export function buildChatCompletionRequest(input: BuildChatCompletionRequestInput): ChatCompletionRequest {
  return {
    model: input.model,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    stream: false,
    messages: [
      {
        role: "system",
        content: LONG_FORM_WRITING_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: [
          `书本：${input.bookTitle}`,
          `当前章节：${input.chapterTitle || "未选择章节"}`,
          "",
          `当前 Skill：${input.skill.name}`,
          input.skill.prompt,
          "",
          "【资料 / 世界观】",
          input.context.worldbuilding || "暂无",
          "",
          "【资料 / 人物关系】",
          input.context.characters || "暂无",
          "",
          "【资料 / 章节摘要】",
          input.context.chapterSummary || "暂无",
          "",
          "【当前章节正文】",
          input.context.chapterContent || "暂无",
          "",
          "【用户指令】",
          input.userInstruction
        ].join("\n")
      }
    ]
  };
}
import { LONG_FORM_WRITING_SYSTEM_PROMPT } from "./prompts";
