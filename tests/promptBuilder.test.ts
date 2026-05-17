import { describe, expect, it } from "vitest";
import { buildChatCompletionRequest } from "../src/features/ai/promptBuilder";

describe("buildChatCompletionRequest", () => {
  it("assembles a continuation request with skill, current chapter, material files, and user instruction", () => {
    const request = buildChatCompletionRequest({
      model: "deepseek-v4-pro",
      temperature: 0.7,
      maxTokens: 1200,
      bookTitle: "星海余烬",
      chapterTitle: "第二章",
      skill: {
        name: "续写",
        prompt: "保持人物动机一致，续写下一幕。"
      },
      context: {
        worldbuilding: "帝国使用跃迁门统治星域。",
        characters: "林澈和阿岚互相隐瞒身份。",
        chapterSummary: "第一章：跃迁门失控。",
        chapterContent: "林澈站在燃烧的港口边缘。"
      },
      userInstruction: "写一段紧张的追逐戏。"
    });

    const content = request.messages.map((message) => message.content).join("\n");

    expect(request.model).toBe("deepseek-v4-pro");
    expect(request.temperature).toBe(0.7);
    expect(request.max_tokens).toBe(1200);
    expect(content).toContain("星海余烬");
    expect(content).toContain("第二章");
    expect(content).toContain("续写");
    expect(content).toContain("帝国使用跃迁门统治星域。");
    expect(content).toContain("林澈和阿岚互相隐瞒身份。");
    expect(content).toContain("第一章：跃迁门失控。");
    expect(content).toContain("林澈站在燃烧的港口边缘。");
    expect(content).toContain("写一段紧张的追逐戏。");
  });
});
