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
        content: [
          "你是一位资深中文长篇小说创作助手，擅长叙事结构、人物塑造和文学性表达。",
          "核心原则：",
          "1. 忠于已建立的世界观、人物性格和剧情事实，绝不擅自修改已有内容。",
          "2. 保持当前作品的叙事视角（第一人称/第三人称）、时态和文风。",
          "3. 输出高质量中文文学文本，注意节奏感、画面感和情绪张力。",
          "4. 直接输出小说正文或创作内容，不要加前言说明、不要复述指令。",
          "5. 如果用户没有指定字数，默认输出 800-1500 字。"
        ].join("\n")
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
