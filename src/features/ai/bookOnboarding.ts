import type { MaterialKind } from "../../types";
import type { ChatCompletionMessage } from "./promptBuilder";

export type StyleSuggestion = {
  name: string;
  description: string;
  exampleSentence: string;
};

export type OnboardingQuestions = {
  protagonist: string;
  conflict: string;
  setting: string;
  openingGoal: string;
};

export type StyleSuggestionResult = {
  styles: StyleSuggestion[];
  questions: OnboardingQuestions;
};

export type OnboardingAnswers = {
  genre: string;
  workingTitle: string;
  styleName: string;
  styleDescription: string;
  customStyle: string;
  protagonist: string;
  conflict: string;
  setting: string;
  openingGoal: string;
};

export type OnboardingStep = "genre" | "style" | "protagonist" | "conflict" | "setting" | "openingGoal" | "complete";

export type OnboardingChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type OnboardingConversation = {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  messages: OnboardingChatMessage[];
  quickReplies: string[];
  isComplete: boolean;
};

export type OnboardingReplyOption = {
  label: string;
  description: string;
  exampleSentence: string;
};

export type OnboardingReplyResult = {
  reply: string;
  options: OnboardingReplyOption[];
  nextStep?: OnboardingStep;
};

export type FinalBookPlan = {
  title: string;
  summary: string;
  worldbuilding: string;
  characters: string;
  plotOutline: string;
  chapterSummary: string;
};

const defaultQuestions: OnboardingQuestions = {
  protagonist: "主角是谁？一句话写出身份、欲望或秘密。",
  conflict: "第一场核心冲突是什么？",
  setting: "故事发生在什么时代、地点或世界规则下？",
  openingGoal: "第一章要让读者看到什么目标、悬念或情感钩子？"
};

const emptyAnswers: OnboardingAnswers = {
  genre: "",
  workingTitle: "",
  styleName: "",
  styleDescription: "",
  customStyle: "",
  protagonist: "",
  conflict: "",
  setting: "",
  openingGoal: ""
};

const defaultStyleReplies = ["冷峻诗意", "轻快爽文", "克制现实", "电影感强"];
const ONBOARDING_OPTION_COUNT = 4;

const fallbackOptionsByStep: Record<Exclude<OnboardingStep, "complete">, OnboardingReplyOption[]> = {
  genre: [
    { label: "悬疑科幻", description: "围绕谜团、技术和未来规则展开。", exampleSentence: "一份会抹去存在的名单，在潮汐声中更新。" },
    { label: "都市奇幻", description: "现实生活里藏着隐秘规则和异能。", exampleSentence: "电梯抵达不存在的负一层，门后有人喊出他的旧名。" },
    { label: "古风权谋", description: "人物关系、身份秘密和局势博弈并重。", exampleSentence: "诏书落印那一刻，满殿臣子都忘了先帝还有一位公主。" },
    { label: "冒险成长", description: "以探索未知和角色蜕变作为主线。", exampleSentence: "她把地图倒过来，才发现故乡原来在海底。" }
  ],
  style: [
    { label: "冷峻悬疑", description: "语言克制，线索密集，氛围压迫。", exampleSentence: "钟声响起时，名单上少了一个名字。" },
    { label: "电影感强", description: "重视场景调度、动作和画面冲击。", exampleSentence: "探照灯扫过海面，旧码头的铁链同时震响。" },
    { label: "诗意慢热", description: "用意象和情绪推进悬念。", exampleSentence: "海雾像一张湿纸，慢慢盖住城市的脸。" },
    { label: "快节奏爽感", description: "冲突明确，反转频繁，推进干脆。", exampleSentence: "他撕下名单第一页，警报就在塔顶炸开。" }
  ],
  protagonist: [
    { label: "失忆守夜人", description: "守着关键地点，也守着缺失的过去。", exampleSentence: "林潮每晚擦亮灯塔，却想不起自己为什么害怕海。" },
    { label: "调查记者", description: "擅长追问真相，容易触碰权力禁区。", exampleSentence: "她的录音笔里，只剩下一段陌生人的心跳。" },
    { label: "名单幸存者", description: "本该被删除，却留下了异常痕迹。", exampleSentence: "所有人都忘了他，只有潮水还会叫他的名字。" },
    { label: "系统技术员", description: "靠近机制核心，知道规则可能被改写。", exampleSentence: "他修复名单漏洞时，看见自己的编号闪了一下。" }
  ],
  conflict: [
    { label: "亲人被抹去", description: "主角必须证明重要的人曾经存在。", exampleSentence: "妹妹的房间还在，户籍里却没有她。" },
    { label: "官方追捕", description: "主角掌握危险证据，被体制压迫。", exampleSentence: "城防局敲门时，他刚把名单塞进怀里。" },
    { label: "倒计时删除", description: "名单即将更新，主角必须抢在时间前行动。", exampleSentence: "退潮前，他只有三小时找回那个名字。" },
    { label: "记忆污染", description: "越接近真相，主角自己的记忆越不可靠。", exampleSentence: "笔记本上的字迹变成了另一个人的手。" }
  ],
  setting: [
    { label: "海上浮城", description: "潮汐能源维系秩序，城市分层明显。", exampleSentence: "上层区看不见海，底层区每天都被雾浸透。" },
    { label: "企业实验区", description: "科技公司控制身份、数据和城市规则。", exampleSentence: "居民手环每亮一次，就有人从系统里被归档。" },
    { label: "末日避难所", description: "资源稀缺，秩序以牺牲个体维持。", exampleSentence: "名单不是惩罚，而是这座城最后的配给表。" },
    { label: "隐秘旧城区", description: "废弃区域保存被官方抹去的痕迹。", exampleSentence: "雾区墙上写满名字，潮水却怎么也洗不掉。" }
  ],
  openingGoal: [
    { label: "发现异常名单", description: "开篇用异常事件立刻抛出核心谜团。", exampleSentence: "他翻到第七页，看见妹妹的名字正在褪色。" },
    { label: "遭遇官方否认", description: "让主角和权力结构正面相撞。", exampleSentence: "档案员说她从未出生，语气像在念天气预报。" },
    { label: "找到遗留物证", description: "用物件证明被删除者仍有痕迹。", exampleSentence: "录音带里传来一声很轻的：哥。" },
    { label: "立下追查目标", description: "结尾让主角做出明确行动选择。", exampleSentence: "涨潮前，他决定去旧码头找最后一个记得她的人。" }
  ]
};

export function createInitialOnboardingConversation(): OnboardingConversation {
  return {
    step: "genre",
    answers: { ...emptyAnswers },
    messages: [
      {
        id: "assistant-genre",
        role: "assistant",
        content: "你好！我是你的小说策划助手。我们来一起搭建一本新书的骨架吧。\n\n先聊聊：你想写什么类型的小说？想到什么就说什么，也可以顺便告诉我一个暂定书名。"
      }
    ],
    quickReplies: defaultStyleReplies,
    isComplete: false
  };
}

export function getNextOnboardingConversation(
  conversation: OnboardingConversation,
  answer: string,
  options: { styleSuggestions?: StyleSuggestionResult } = {}
): OnboardingConversation {
  const content = answer.trim();
  if (!content || conversation.isComplete) return conversation;

  const nextAnswers = recordAnswer(conversation, content);
  const nextStep = getNextStep(conversation.step);
  const userMessage: OnboardingChatMessage = {
    id: `user-${conversation.messages.length + 1}`,
    role: "user",
    content
  };
  const assistantMessage: OnboardingChatMessage = {
    id: `assistant-${nextStep}`,
    role: "assistant",
    content: getAssistantPrompt(nextStep, options.styleSuggestions)
  };

  return {
    step: nextStep,
    answers: nextAnswers,
    messages: [...conversation.messages, userMessage, assistantMessage],
    quickReplies: getQuickReplies(nextStep, options.styleSuggestions),
    isComplete: nextStep === "complete"
  };
}

export function summarizeOnboardingAnswers(answers: OnboardingAnswers): OnboardingAnswers {
  return {
    ...emptyAnswers,
    ...answers
  };
}

export function recordOnboardingAnswer(conversation: OnboardingConversation, answer: string): OnboardingConversation {
  const content = answer.trim();
  if (!content || conversation.isComplete) return conversation;

  const nextStep = getNextStep(conversation.step);
  return {
    step: nextStep,
    answers: recordAnswer(conversation, content),
    messages: [
      ...conversation.messages,
      {
        id: `user-${conversation.messages.length + 1}`,
        role: "user",
        content
      }
    ],
    quickReplies: [],
    isComplete: nextStep === "complete"
  };
}

export function appendUserMessageOnly(conversation: OnboardingConversation, answer: string): OnboardingConversation {
  const content = answer.trim();
  if (!content || conversation.isComplete) return conversation;
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: `user-${conversation.messages.length + 1}`,
        role: "user",
        content
      }
    ],
    quickReplies: []
  };
}

export function advanceToStep(
  conversation: OnboardingConversation,
  answer: string,
  nextStep: OnboardingStep
): OnboardingConversation {
  const content = answer.trim();
  if (!content) return conversation;
  const updatedAnswers = { ...conversation.answers };
  if (conversation.step === "genre") updatedAnswers.genre = content;
  if (conversation.step === "style") updatedAnswers.styleName = content;
  if (conversation.step === "protagonist") updatedAnswers.protagonist = content;
  if (conversation.step === "conflict") updatedAnswers.conflict = content;
  if (conversation.step === "setting") updatedAnswers.setting = content;
  if (conversation.step === "openingGoal") updatedAnswers.openingGoal = content;
  return {
    ...conversation,
    step: nextStep,
    answers: updatedAnswers,
    isComplete: nextStep === "complete"
  };
}

export function appendOnboardingAssistantReply(
  conversation: OnboardingConversation,
  result: OnboardingReplyResult
): OnboardingConversation {
  return {
    ...conversation,
    messages: [
      ...conversation.messages,
      {
        id: `assistant-${conversation.step}-${conversation.messages.length + 1}`,
        role: "assistant",
        content: result.reply
      }
    ],
    quickReplies: result.options.map((option) => option.label)
  };
}

export function buildOnboardingReplyMessages(input: {
  conversation: OnboardingConversation;
  answer: string;
  styleSuggestions?: StyleSuggestionResult | null;
}): ChatCompletionMessage[] {
  const possibleNextStep = getNextStep(input.conversation.step);
  const currentStepQuestion = getStepQuestion(input.conversation.step, input.styleSuggestions);
  return [
    {
      role: "system",
      content: [
        "你是一位温暖的中文长篇小说策划助手，正在通过对话帮用户搭建新书骨架。",
        "每次回复都要体现你认真阅读了用户此前提供的信息。",
        "只输出合法 JSON，不要输出 markdown 或解释。",
        'json 结构：{"reply":"","options":[{"label":"","description":"","exampleSentence":""}],"nextStep":""}',
        "reply：2-3 句话，先回应用户，再自然引出下一问。",
        "options：恰好 4 个可点击选项；如果 nextStep 是 complete，options 设为空数组。",
        `nextStep 必须是以下值之一：${ALL_STEPS.join("、")}`,
        "",
        "【重要】回答验证规则：",
        "如果用户的回答明显没有回应「当前步骤」的问题（比如答非所问、过于笼统、或与小说创作完全无关），你必须在 reply 中温和地指出问题，并重新提出当前步骤的问题。",
        "此时 nextStep 必须等于当前步骤（即不推进），options 保留当前步骤的可选答案。",
        "只有当用户的回答确实回应了当前步骤的问题时，才把 nextStep 设为下一步。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请根据当前对话状态生成下一条助手回复。",
        `当前步骤：${input.conversation.step}`,
        `当前步骤的问题：${currentStepQuestion}`,
        `默认下一步：${possibleNextStep}`,
        `用户最新回答：${input.answer}`,
        `已收集信息：${JSON.stringify(input.conversation.answers)}`,
        `风格候选数据：${JSON.stringify(input.styleSuggestions ?? null)}`
      ].join("\n")
    }
  ];
}

export function buildCombinedGenreReplyMessages(input: {
  conversation: OnboardingConversation;
  answer: string;
}): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是一位温暖的中文长篇小说策划助手。",
        "只输出合法 JSON，不要输出 markdown 或解释。",
        'json 结构：{"reply":"","options":[{"label":"","description":"","exampleSentence":""}],"nextStep":"","styles":[{"name":"","description":"","exampleSentence":""}],"questions":{"protagonist":"","conflict":"","setting":"","openingGoal":""}}',
        "",
        "你的任务：",
        "1. 判断用户回答是否是有效的小说类型（如科幻、言情、悬疑、奇幻、武侠、都市等）。",
        "2. 如果有效：reply 中肯定用户选择并引导到风格步骤；nextStep 设为 style。",
        "   同时根据类型生成 3-5 个风格候选 styles 和后续 4 个问题 questions。",
        "3. 如果无效（答非所问、与小说无关）：reply 中温和指出并重新询问类型；nextStep 设为 genre；styles 和 questions 留空。",
        "",
        "reply：2-3 句话。",
        "options：恰好 4 个可点击选项；如果 nextStep 是 complete，options 设为空数组。",
        `nextStep 只能是：${ALL_STEPS.join("、")}`,
        "styles：每个有 name、description、exampleSentence。",
        "questions：protagonist、conflict、setting、openingGoal 各一句简短问题。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请判断用户回答并生成对应内容。",
        `当前步骤：genre（小说类型）`,
        `用户回答：${input.answer}`,
        `已收集信息：${JSON.stringify(input.conversation.answers)}`
      ].join("\n")
    }
  ];
}

export function parseOnboardingReply(raw: string): OnboardingReplyResult {
  const parsed = parseJsonObject(raw);
  const reply = asText(parsed.reply);
  if (!reply) {
    throw new Error("AI reply is missing.");
  }

  const options = Array.isArray(parsed.options)
    ? parsed.options
        .map((item) => ({
          label: asText(item?.label ?? item?.name),
          description: asText(item?.description),
          exampleSentence: asText(item?.exampleSentence ?? item?.example)
        }))
        .filter((item) => item.label)
        .slice(0, ONBOARDING_OPTION_COUNT)
    : [];

  const nextStep = isValidStep(asText(parsed.nextStep)) ? asText(parsed.nextStep) as OnboardingStep : undefined;

  return { reply, options, nextStep };
}

export function parseCombinedGenreReply(raw: string): {
  replyResult: OnboardingReplyResult;
  styleSuggestions: StyleSuggestionResult | null;
} {
  const parsed = parseJsonObject(raw);
  const reply = asText(parsed.reply);
  if (!reply) {
    throw new Error("AI reply is missing.");
  }

  const options = Array.isArray(parsed.options)
    ? parsed.options
        .map((item) => ({
          label: asText(item?.label ?? item?.name),
          description: asText(item?.description),
          exampleSentence: asText(item?.exampleSentence ?? item?.example)
        }))
        .filter((item) => item.label)
        .slice(0, ONBOARDING_OPTION_COUNT)
    : [];

  const nextStep = isValidStep(asText(parsed.nextStep)) ? asText(parsed.nextStep) as OnboardingStep : undefined;

  const styles = Array.isArray(parsed.styles)
    ? parsed.styles
        .map((item) => ({
          name: asText(item?.name),
          description: asText(item?.description),
          exampleSentence: asText(item?.exampleSentence)
        }))
        .filter((item) => item.name && item.description && item.exampleSentence)
        .slice(0, 5)
    : [];

  const rawQuestions = parsed.questions && typeof parsed.questions === "object" ? parsed.questions : {};
  let styleSuggestions: StyleSuggestionResult | null = null;
  if (styles.length >= 3) {
    styleSuggestions = {
      styles,
      questions: {
        protagonist: asText(rawQuestions.protagonist) || defaultQuestions.protagonist,
        conflict: asText(rawQuestions.conflict) || defaultQuestions.conflict,
        setting: asText(rawQuestions.setting) || defaultQuestions.setting,
        openingGoal: asText(rawQuestions.openingGoal) || defaultQuestions.openingGoal
      }
    };
  }

  return {
    replyResult: { reply, options, nextStep },
    styleSuggestions
  };
}

export function buildStyleSuggestionMessages(input: { genre: string; workingTitle?: string }): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是中文长篇小说策划助手。",
        "你必须只输出 JSON，不要输出 markdown，不要输出解释。",
        'json 结构：{"styles":[{"name":"","description":"","exampleSentence":""}],"questions":{"protagonist":"","conflict":"","setting":"","openingGoal":""}}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请根据用户选择的小说类型生成 3 到 5 个适合的小说风格选项。",
        "每个风格都要有一句可直接展示给用户的中文示例句。",
        "同时生成后续 4 个简短问题：主角、核心冲突、世界/时代、开篇目标。",
        "输出必须是合法 JSON。",
        "",
        `类型：${input.genre}`,
        `暂定书名：${input.workingTitle?.trim() || "未定"}`
      ].join("\n")
    }
  ];
}

export function buildFinalizeBookMessages(input: OnboardingAnswers): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是中文长篇小说资料库整理助手。",
        "你必须只输出合法 JSON，不要输出 markdown，不要输出解释。",
        'json 结构：{"title":"","summary":"","worldbuilding":"","characters":"","plotOutline":"","chapterSummary":""}'
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请把下面的新书访谈答案整理成一本小说的基础资料。",
        "title 必须是书名；如果暂定书名为空，请根据内容生成一个简短中文书名。",
        "summary 是书本简介，适合显示在书架。",
        "worldbuilding 记录类型、风格、世界/时代、叙事气质。",
        "characters 记录主角和重要关系苗头。",
        "plotOutline 记录可持续扩展的章节大纲，至少包含第一章方向和后续 2-4 个情节点。",
        "chapterSummary 记录核心冲突、第一章目标和开篇方向。",
        "输出必须是合法 JSON。",
        "",
        `类型：${input.genre}`,
        `暂定书名：${input.workingTitle || "未定"}`,
        `风格：${input.customStyle || input.styleName}`,
        `风格说明：${input.customStyle ? "用户自定义" : input.styleDescription}`,
        `主角：${input.protagonist}`,
        `核心冲突：${input.conflict}`,
        `世界/时代：${input.setting}`,
        `开篇目标：${input.openingGoal}`
      ].join("\n")
    }
  ];
}

export function parseStyleSuggestions(raw: string): StyleSuggestionResult {
  const parsed = parseJsonObject(raw);
  const styles = Array.isArray(parsed.styles)
    ? parsed.styles
        .map((item) => ({
          name: asText(item?.name),
          description: asText(item?.description),
          exampleSentence: asText(item?.exampleSentence)
        }))
        .filter((item) => item.name && item.description && item.exampleSentence)
        .slice(0, 5)
    : [];

  if (styles.length < 3) {
    throw new Error("AI 返回的风格选项不足，请重试。");
  }

  const questions = parsed.questions && typeof parsed.questions === "object" ? parsed.questions : {};
  return {
    styles,
    questions: {
      protagonist: asText(questions.protagonist) || defaultQuestions.protagonist,
      conflict: asText(questions.conflict) || defaultQuestions.conflict,
      setting: asText(questions.setting) || defaultQuestions.setting,
      openingGoal: asText(questions.openingGoal) || defaultQuestions.openingGoal
    }
  };
}

export function parseFinalBookPlan(raw: string): FinalBookPlan {
  const parsed = parseJsonObject(raw);
  const plan = {
    title: asText(parsed.title),
    summary: asText(parsed.summary),
    worldbuilding: asText(parsed.worldbuilding),
    characters: asText(parsed.characters),
    plotOutline: asText(parsed.plotOutline),
    chapterSummary: asText(parsed.chapterSummary)
  };

  if (!plan.title || !plan.summary || !plan.worldbuilding || !plan.characters || !plan.plotOutline || !plan.chapterSummary) {
    throw new Error("AI 返回的书籍资料不完整，请重试。");
  }

  return plan;
}

export function formatOnboardingMaterials(plan: FinalBookPlan): Partial<Record<MaterialKind, string>> {
  return {
    worldbuilding: plan.worldbuilding,
    characters: plan.characters,
    plotOutline: plan.plotOutline,
    chapterSummary: plan.chapterSummary
  };
}

function recordAnswer(conversation: OnboardingConversation, content: string): OnboardingAnswers {
  const nextAnswers = { ...conversation.answers };
  if (conversation.step === "genre") nextAnswers.genre = content;
  if (conversation.step === "style") nextAnswers.styleName = content;
  if (conversation.step === "protagonist") nextAnswers.protagonist = content;
  if (conversation.step === "conflict") nextAnswers.conflict = content;
  if (conversation.step === "setting") nextAnswers.setting = content;
  if (conversation.step === "openingGoal") nextAnswers.openingGoal = content;
  return nextAnswers;
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
    throw new Error("AI 没有返回合法 JSON。");
  }

  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("AI 返回的 JSON 必须是对象。");
    }
    return parsed;
  } catch {
    throw new Error("AI 返回的 JSON 无法解析，请重试。");
  }
}

function getNextStep(step: OnboardingStep): OnboardingStep {
  if (step === "genre") return "style";
  if (step === "style") return "protagonist";
  if (step === "protagonist") return "conflict";
  if (step === "conflict") return "setting";
  if (step === "setting") return "openingGoal";
  return "complete";
}

function getAssistantPrompt(step: OnboardingStep, styleSuggestions?: StyleSuggestionResult): string {
  if (step === "style") {
    return "这个类型不错。接下来选一种小说风格：你可以直接输入，也可以点下面的风格建议。";
  }
  if (step === "protagonist") return styleSuggestions?.questions.protagonist ?? defaultQuestions.protagonist;
  if (step === "conflict") return styleSuggestions?.questions.conflict ?? defaultQuestions.conflict;
  if (step === "setting") return styleSuggestions?.questions.setting ?? defaultQuestions.setting;
  if (step === "openingGoal") return styleSuggestions?.questions.openingGoal ?? defaultQuestions.openingGoal;
  return "信息够了。我会开始整理资料库，并生成书本简介、世界观、人物库、章节大纲和章节摘要。";
}

function getQuickReplies(step: OnboardingStep, styleSuggestions?: StyleSuggestionResult): string[] {
  if (step === "style") return styleSuggestions?.styles.map((style) => style.name) ?? defaultStyleReplies;
  return [];
}

export function getStepQuestion(step: OnboardingStep, styleSuggestions?: StyleSuggestionResult | null): string {
  if (step === "genre") return "你想写什么类型的小说？";
  if (step === "style") return "选一种小说风格，你可以直接输入或点选建议。";
  if (step === "protagonist") return styleSuggestions?.questions.protagonist ?? defaultQuestions.protagonist;
  if (step === "conflict") return styleSuggestions?.questions.conflict ?? defaultQuestions.conflict;
  if (step === "setting") return styleSuggestions?.questions.setting ?? defaultQuestions.setting;
  if (step === "openingGoal") return styleSuggestions?.questions.openingGoal ?? defaultQuestions.openingGoal;
  return "所有问题已完成。";
}

export function validateOnboardingAnswer(step: OnboardingStep, answer: string): { valid: boolean; reason: string } {
  const content = answer.trim();
  if (!content) {
    return { valid: false, reason: "请输入你的回答，不能为空。" };
  }

  const MIN_LENGTH: Record<string, number> = {
    genre: 2,
    style: 2,
    protagonist: 4,
    conflict: 4,
    setting: 4,
    openingGoal: 4
  };

  const minLength = MIN_LENGTH[step] ?? 2;
  if (content.length < minLength) {
    return { valid: false, reason: `回答太短了，至少需要 ${minLength} 个字。` };
  }

  const trivialPatterns = /^(不知道|随便|跳过|没有|无|都行|随便吧|无所谓|都一样|不知道啊|嗯|啊|哦|好|ok|yes|no|\.+|-+|…+|同上)$/i;
  if (trivialPatterns.test(content)) {
    const STEP_LABELS: Record<string, string> = {
      genre: "小说类型",
      style: "写作风格",
      protagonist: "主角设定",
      conflict: "核心冲突",
      setting: "世界/时代设定",
      openingGoal: "开篇目标"
    };
    const label = STEP_LABELS[step] ?? "当前问题";
    return { valid: false, reason: `「${content}」不算是一个有效的${label}，请认真回答这个问题。` };
  }

  const offTopicPatterns = /想吃|番茄|鸡蛋|炒蛋|今天吃|午饭|晚饭|早餐|点外卖|吃什么|天气|下雨|打游戏|刷|追剧|抖音|游戏|睡觉|去玩/;
  if (offTopicPatterns.test(content)) {
    const STEP_LABELS: Record<string, string> = {
      genre: "小说类型",
      style: "写作风格",
      protagonist: "主角设定",
      conflict: "核心冲突",
      setting: "世界/时代设定",
      openingGoal: "开篇目标"
    };
    const label = STEP_LABELS[step] ?? "当前问题";
    return { valid: false, reason: `看起来你的回答和${label}无关哦？请认真告诉我你想写什么样的小说。` };
  }

  return { valid: true, reason: "" };
}

const ALL_STEPS: OnboardingStep[] = ["genre", "style", "protagonist", "conflict", "setting", "openingGoal", "complete"];

function isValidStep(value: string): boolean {
  return ALL_STEPS.includes(value as OnboardingStep);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ─── Option normalization & retry helpers ────────────────────────────

/**
 * Clean, deduplicate, and truncate options to exactly ONBOARDING_OPTION_COUNT.
 * Returns the cleaned list (may be fewer than 4 if not enough valid options).
 */
export function normalizeOptions(options: OnboardingReplyOption[]): OnboardingReplyOption[] {
  const seen = new Set<string>();
  const result: OnboardingReplyOption[] = [];
  for (const opt of options) {
    const label = opt.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...opt, label });
    if (result.length >= ONBOARDING_OPTION_COUNT) break;
  }
  return result;
}

/**
 * Build messages for a retry/backfill request when the first AI response
 * returned fewer than ONBOARDING_OPTION_COUNT options.
 */
export function buildOptionRetryMessages(input: {
  step: OnboardingStep;
  currentQuestion: string;
  userAnswer: string;
  collectedAnswers: OnboardingAnswers;
  firstReply: string;
  firstOptions: OnboardingReplyOption[];
  neededCount: number;
}): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是中文长篇小说策划助手。你的任务是为当前访谈步骤补充更多可点击选项。",
        "只输出合法 JSON，不要输出 markdown 或解释。",
        'json 结构：{"options":[{"label":"","description":"","exampleSentence":""}]}',
        `请返回恰好 ${input.neededCount} 个新的、与已有选项不重复的可点击选项。`,
        "每个选项必须有 label、description 和 exampleSentence。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `当前步骤：${input.step}`,
        `当前步骤的问题：${input.currentQuestion}`,
        `用户最新回答：${input.userAnswer}`,
        `已收集信息：${JSON.stringify(input.collectedAnswers)}`,
        `AI 已生成的回复：${input.firstReply}`,
        `已有选项（不要重复）：${JSON.stringify(input.firstOptions.map((o) => o.label))}`,
        `还需要 ${input.neededCount} 个补充选项。`
      ].join("\n")
    }
  ];
}

/**
 * Get the local fallback options for a given step.
 */
export function getFallbackOptions(step: OnboardingStep): OnboardingReplyOption[] {
  if (step === "complete") return [];
  return fallbackOptionsByStep[step] ?? [];
}

/**
 * Pad options up to ONBOARDING_OPTION_COUNT using local fallback options.
 * Only adds fallback options whose labels don't already appear in the list.
 */
export function padOptionsWithFallback(
  options: OnboardingReplyOption[],
  step: OnboardingStep
): OnboardingReplyOption[] {
  if (step === "complete") return options;
  if (options.length >= ONBOARDING_OPTION_COUNT) return options;

  const existingLabels = new Set(options.map((o) => o.label.toLowerCase()));
  const fallbacks = fallbackOptionsByStep[step] ?? [];
  const padded = [...options];
  for (const fb of fallbacks) {
    if (padded.length >= ONBOARDING_OPTION_COUNT) break;
    if (existingLabels.has(fb.label.toLowerCase())) continue;
    padded.push(fb);
    existingLabels.add(fb.label.toLowerCase());
  }
  return padded.slice(0, ONBOARDING_OPTION_COUNT);
}
