import type { Book, ChapterFile, MaterialFile, MaterialKind, SkillAction, SkillTemplate, Volume } from "../../types";

export type LibraryState = {
  books: Book[];
  volumes: Record<string, Volume[]>;
  chapters: Record<string, ChapterFile[]>;
  materials: Record<string, MaterialFile[]>;
  skills: SkillTemplate[];
};

type NewBookInput = {
  title: string;
  summary: string;
  firstChapterContent?: string;
  materials?: Partial<Record<MaterialKind, string>>;
};

const materialDefinitions: Array<{ kind: MaterialKind; title: string }> = [
  { kind: "worldbuilding", title: "世界观" },
  { kind: "characters", title: "人物关系" },
  { kind: "plotOutline", title: "章节大纲" },
  { kind: "chapterSummary", title: "章节摘要" }
];

const DEFAULT_SKILL_ACTIONS: Record<string, SkillAction> = {
  "continue-writing": "appendText",
  "dialogue-generation": "appendText",
  "scene-description": "appendText",
  "action-scene": "appendText",
  "inner-monologue": "appendText",
  "rewrite-polish": "replaceSelection",
  "condense-text": "replaceSelection",
  "expand-detail": "replaceSelection",
  "summarize-chapter": "chatOnly",
  "pacing-check": "chatOnly",
  "consistency-check": "chatOnly",
  "expand-setting": "updateMaterials",
  "character-profile": "updateMaterials"
};

const VALID_SKILL_ACTIONS = new Set<SkillAction>(["appendText", "replaceSelection", "updateMaterials", "chatOnly"]);

export function createEmptyLibraryState(): LibraryState {
  return {
    books: [],
    volumes: {},
    chapters: {},
    materials: {},
    skills: createDefaultSkills()
  };
}

export function createDefaultSkills(): SkillTemplate[] {
  const now = new Date().toISOString();

  return [
    // ── 创作 ──
    {
      id: "continue-writing",
      name: "续写",
      prompt: "续写接下来的情节。\n\n要求：\n- 延续当前场景的叙事节奏和视角，不可在中途切换叙事视角（如从第一人称跳到第三人称）\n- 推动剧情发展，不要原地踏步或重复上文已交代的内容\n- 人物对话要符合角色性格和说话习惯，参考角色档案中的语气特征\n- 自然衔接上文末尾的情绪和悬念\n- 如果上文以对话结尾，续写应以对话或动作响应开始；如果以动作结尾，续写应以动作结果或心理反应开始\n- 控制在 300-800 字，不要写到段落中途戛然而止\n\n禁忌：\n- 不要引入与当前场景无关的新支线\n- 不要重复上文已有的描写\n- 不要使用「突然」「忽然」等词超过一次",
      action: "appendText",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "dialogue-generation",
      name: "对话生成",
      prompt: "根据当前场景和人物关系，生成一段自然生动的对话。\n\n要求：\n- 每个角色的说话方式要有区分度：语气、用词习惯、句式长短都应不同\n- 对话要推动情节或揭示人物性格，避免无意义的日常闲聊\n- 适当穿插动作描写（如低头、攥拳、移开视线）和心理反应，不要写纯对话\n- 注意对话的潜台词：人物说的和想的可以不同，让读者感受到言外之意\n- 对话标签尽量用「说」「问」或省略，避免过度使用「叹道」「冷哼」「怒喝」等标签\n- 每段对话控制在 4-8 轮（一来一回算一轮）\n\n禁忌：\n- 不要让角色用长篇独白解释剧情（信息轰炸）\n- 不要让所有角色用同一种语气说话\n- 不要出现不符合角色身份的书面语或现代网络用语（除非角色设定允许）",
      action: "appendText",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "scene-description",
      name: "场景描写",
      prompt: "为当前场景撰写细腻的环境描写。\n\n要求：\n- 调动至少三种感官（视觉必选，再搭配听觉、嗅觉、触觉或味觉中的两种）\n- 环境描写要暗示或烘托当前情绪氛围：紧张场景用压迫感强的细节，温馨场景用柔和的意象\n- 注意光影、天气、时间等细节与前文的连贯性\n- 用具体细节替代抽象描述：「夕阳把桌面染成橘红色」优于「夕阳西下很美」\n- 场景转换时（如从室内到室外），要有过渡描写\n- 控制在 150-400 字\n\n禁忌：\n- 不要堆砌形容词（如「美丽的」「壮观的」「雄伟的」连续使用）\n- 不要脱离情节写纯风景（环境描写要为叙事服务）\n- 不要在快速动作场景中插入大段静态环境描写",
      action: "appendText",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "action-scene",
      name: "动作场面",
      prompt: "撰写一段紧张刺激的动作/冲突场面。\n\n要求：\n- 用短句和断句营造紧迫感，动作描写要具体、有画面感\n- 穿插角色的内心反应和战术思考（但不要在关键动作中间插入长段心理描写）\n- 注意空间感：让读者清楚人物的相对位置、移动方向和环境障碍\n- 动作要符合角色能力设定，参考角色档案中的能力体系\n- 节奏要有张有弛：可以穿插短暂的喘息或对话来调节节奏\n- 受伤和体力消耗要累计，不要让角色在长时间战斗后依然精力充沛\n\n禁忌：\n- 不要从头到尾保持同一强度（读者会疲劳）\n- 不要忽略物理逻辑（如重力、惯性、距离）\n- 不要让角色做出超越其能力设定的动作\n- 不要使用「只见」「霎时」等套路化武侠用语",
      action: "appendText",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "inner-monologue",
      name: "内心独白",
      prompt: "撰写角色的内心独白或心理活动。\n\n要求：\n- 以角色的语气和认知水平思考，不要变成全知视角的作者旁白\n- 展现角色的矛盾、犹豫或顿悟，增加心理深度：内心的纠结比直接下决定更有吸引力\n- 与当前情节紧密关联，不做无目的的回忆（如果插入回忆，必须与当下困境形成对照）\n- 内心独白要推动角色成长或改变决策，不能只是原地纠结\n- 可以展现角色外在行为与内心想法的反差（嘴上说不要，心里其实在意）\n- 控制在 150-400 字\n\n禁忌：\n- 不要让角色的思考过于理性化和条理化（真实的人的思绪是跳跃的）\n- 不要在内心独白中向读者解释世界观设定\n- 不要让角色在内心独白中做出读者早已知道的结论",
      action: "appendText",
      createdAt: now,
      updatedAt: now
    },
    // ── 编辑 ──
    {
      id: "rewrite-polish",
      name: "润色",
      prompt: "对选中段落进行文学润色。\n\n要求：\n- 不改变任何剧情事实和人物关系\n- 增强描写的画面感和感官细节：用具体意象替代抽象概括\n- 优化句式节奏：长短句交替增加韵律感，避免连续多个相同句式\n- 修正口语化或重复的表达：同一个意思不要用相同词语表达两次\n- 保留作者原有的文风和叙事调性，不要改成完全不同的风格\n- 检查并修正可能的词汇单调问题：同一个段落中避免重复使用同一个动词或形容词\n\n禁忌：\n- 不要过度修饰（把简洁有力的句子改得啰嗦）\n- 不要改变段落的叙事节奏（快节奏段落不应被放慢）\n- 不要添加原文中没有的情感色彩",
      action: "replaceSelection",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "condense-text",
      name: "精简压缩",
      prompt: "精简选中的段落，去除冗余表达。\n\n要求：\n- 保留所有关键信息和情节节点，一个都不能丢\n- 删除重复描写：同一个特征不需要描写两次\n- 删除无用修饰：不影响理解的形容词和副词可以去掉\n- 删除拖沓过渡：「他慢慢地」「她缓缓地」这类拖慢节奏但无信息量的表达\n- 合并意思相近的句子：两个句子说同一件事时，合并为一句\n- 精简后字数减少 30%-50%，但信息量不丢失\n- 输出精简后的完整段落（不要只输出被修改的句子）\n\n禁忌：\n- 不要删除人物对话（对话可以简化但不能删除）\n- 不要删除关键转折或伏笔\n- 不要让精简后的文字变得生硬断续",
      action: "replaceSelection",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "expand-detail",
      name: "扩展细节",
      prompt: "为选中的段落补充更多细节描写。\n\n要求：\n- 在原有框架上扩展，不改变情节走向和事件结果\n- 增加感官细节：视觉（颜色、光影）、听觉（环境音）、触觉（温度、质感）\n- 补充人物微表情和肢体语言：攥紧的拳头、不自觉的叹息、移开的视线\n- 适当扩展环境描写和心理描写，但不要喧宾夺主\n- 扩展后保持文风统一，新增细节要和原有文字融为一体\n- 控制扩展幅度：原文 100 字左右可扩展到 200-300 字\n\n禁忌：\n- 不要扩展对话内容（对话应保持原样）\n- 不要在快速推进的情节中强行插入大段描写\n- 不要添加原文暗示范围之外的情感\n- 不要让新增细节与前后文产生矛盾",
      action: "replaceSelection",
      createdAt: now,
      updatedAt: now
    },
    // ── 分析 ──
    {
      id: "summarize-chapter",
      name: "总结章节",
      prompt: "为当前章节撰写结构化摘要。\n\n输出格式（严格按此结构）：\n1. 核心事件：1-2 句话概括本章最重要的剧情进展\n2. 人物状态变化：列出本章中角色状态/关系的关键变化\n3. 新伏笔与线索：标注本章新埋下的伏笔或悬念（如有）\n4. 未解悬念：列出本章结束后仍悬而未决的问题（如有）\n5. 与主线的关联：本章如何推进了整体故事线\n\n要求：\n- 总字数控制在 200 字以内，便于后续章节引用\n- 只记录本章实际发生的事情，不要推测或编造\n- 人物状态变化要具体：「A 从不信任 B 变为开始依赖 B」而非「A 和 B 的关系改变了」",
      action: "chatOnly",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "pacing-check",
      name: "节奏检查",
      prompt: "分析当前章节的叙事节奏。\n\n分析维度：\n1. 节奏分布：标注每个段落的节奏类型（对话/描写/动作/心理/过渡），统计各类占比\n2. 节奏曲线：从章节开头到结尾，节奏变化是否合理（是否需要「开头慢热→中段加速→高潮爆发→收尾缓冲」的曲线）\n3. 具体问题：指出节奏过快（信息密度过高、事件切换过频）或过慢（描写冗长、对话拖沓）的具体段落\n4. 过渡检查：紧张场景和平静场景之间的过渡是否自然，还是生硬切换\n5. 节奏单一性：是否存在连续 3 段以上相同节奏类型的段落\n\n输出要求：\n- 给出具体的节奏调整建议，包括建议删减、扩展或重排的段落编号或位置\n- 用简洁的评分（1-5）标示整体节奏水平",
      action: "chatOnly",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "consistency-check",
      name: "一致性检查",
      prompt: "检查当前章节与已有资料（世界观、人物关系、章节摘要）的一致性。\n\n检查维度：\n1. 人物一致性：性格表现是否符合角色档案，是否有不符合设定的行为或语气\n2. 世界观一致性：能力体系、地理设定、社会规则是否与前文矛盾\n3. 时间线一致性：事件发生的时间顺序是否合理，是否有时间跳跃未交代\n4. 空间一致性：人物位置和移动是否合理，是否出现瞬移问题\n5. 物品一致性：关键道具和装备是否前后一致\n6. 称呼一致性：同一人物在不同场景中的称呼是否一致\n\n输出要求：\n- 逐条列出发现的矛盾，标注严重程度（高/中/低）\n- 高严重度：直接影响读者理解的硬伤\n- 中严重度：可能让细心读者出戏的问题\n- 低严重度：可能只是读者忽略的小细节\n- 每条问题给出具体的修改建议",
      action: "chatOnly",
      createdAt: now,
      updatedAt: now
    },
    // ── 资料 ──
    {
      id: "expand-setting",
      name: "补全资料",
      prompt: "根据已有章节内容，提取并整理资料库。\n\n提取范围：\n1. 新登场人物：姓名、外貌特征、性格关键词、说话方式、与其他人物的关系\n2. 世界观设定：新揭示的规则、能力体系、社会结构、历史事件\n3. 重要物品：功能、来源、当前持有者\n4. 地点信息：地理位置、环境特征、重要事件发生地\n5. 时间线：关键事件的发生顺序和时间节点\n\n要求：\n- 确保与已有资料完全一致，不引入矛盾\n- 如果新内容与已有资料有冲突，标注冲突并说明以哪个版本为准\n- 信息要具体：不要写「他很强大」，要写「他能在一瞬间移动百米」\n- 不要编造正文中没有提到的信息",
      action: "updateMaterials",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "character-profile",
      name: "角色档案",
      prompt: "为当前章节中重点出场的人物生成或更新角色档案。\n\n档案结构：\n1. 基本信息：姓名、年龄、外貌特征（只记录正文明确提到的）\n2. 性格特征：3-5 个关键词 + 每个关键词对应的正文中具体表现\n3. 说话习惯：口头禅、语气特征、常用句式（如有）\n4. 人际关系：与其他人物的关系及本章中的关系演变\n5. 当前状态：位置、情绪、掌握的关键信息\n6. 核心动机：驱动这个角色行动的根本原因\n7. 成长弧线：从登场到现在，角色发生了什么变化\n\n要求：\n- 与已有角色资料合并，不覆盖未改变的字段\n- 只基于正文内容提取，不要推测或编造\n- 性格特征必须附具体表现，不要只给空泛标签\n- 标注本章中角色的新变化（用【本章新增】标记）",
      action: "updateMaterials",
      createdAt: now,
      updatedAt: now
    }
  ];
}

export function createBook(state: LibraryState, input: NewBookInput): { state: LibraryState; book: Book } {
  const now = new Date().toISOString();
  const book: Book = {
    id: createId("book"),
    title: input.title.trim() || "未命名书本",
    summary: input.summary.trim(),
    status: "drafting",
    createdAt: now,
    updatedAt: now
  };

  const volume: Volume = {
    id: createId("volume"),
    bookId: book.id,
    title: "第一卷",
    order: 1,
    createdAt: now,
    updatedAt: now
  };

  const chapter = createChapterFile(book.id, volume.id, "第一章", 1, input.firstChapterContent ?? "", now);

  return {
    book,
    state: {
      ...state,
      books: [book, ...state.books],
      volumes: {
        ...state.volumes,
        [book.id]: [volume]
      },
      chapters: {
        ...state.chapters,
        [book.id]: [chapter]
      },
      materials: {
        ...state.materials,
        [book.id]: createDefaultMaterials(book.id, now, input.materials)
      }
    }
  };
}

export function createVolume(
  state: LibraryState,
  bookId: string,
  title: string
): { state: LibraryState; volume: Volume } {
  const now = new Date().toISOString();
  const current = getBookVolumes(state, bookId);
  const volume: Volume = {
    id: createId("volume"),
    bookId,
    title: title.trim() || `第${current.length + 1}卷`,
    order: current.length + 1,
    createdAt: now,
    updatedAt: now
  };

  return {
    volume,
    state: {
      ...state,
      volumes: {
        ...state.volumes,
        [bookId]: [...current, volume]
      }
    }
  };
}

export function deleteVolume(state: LibraryState, volumeId: string): LibraryState {
  const volume = findVolume(state, volumeId);
  if (!volume) return state;

  const bookChapters = getBookChapters(state, volume.bookId);
  const volumeChapterIds = new Set(
    bookChapters.filter((ch) => ch.volumeId === volumeId).map((ch) => ch.id)
  );

  return {
    ...state,
    volumes: {
      ...state.volumes,
      [volume.bookId]: state.volumes[volume.bookId]?.filter((v) => v.id !== volumeId) ?? []
    },
    chapters: {
      ...state.chapters,
      [volume.bookId]: (state.chapters[volume.bookId] ?? []).filter((ch) => !volumeChapterIds.has(ch.id))
    }
  };
}

export function createChapter(
  state: LibraryState,
  bookId: string,
  volumeId: string,
  title: string
): { state: LibraryState; chapter: ChapterFile } {
  const now = new Date().toISOString();
  const current = getBookChapters(state, bookId);
  const chapter = createChapterFile(bookId, volumeId, title.trim() || `第 ${current.length + 1} 章`, current.length + 1, "", now);

  return {
    chapter,
    state: {
      ...state,
      chapters: {
        ...state.chapters,
        [bookId]: [...current, chapter]
      }
    }
  };
}

export function updateBookSummary(state: LibraryState, bookId: string, summary: string): LibraryState {
  return {
    ...state,
    books: state.books.map((book) =>
      book.id === bookId ? { ...book, summary, updatedAt: new Date().toISOString() } : book
    )
  };
}

export function updateChapterTitle(state: LibraryState, chapterId: string, title: string): LibraryState {
  const now = new Date().toISOString();
  return {
    ...state,
    chapters: mapChapter(state.chapters, chapterId, (chapter) => ({ ...chapter, title: title.trim() || "未命名章节", updatedAt: now }))
  };
}

export function updateBookTitle(state: LibraryState, bookId: string, title: string): LibraryState {
  return {
    ...state,
    books: state.books.map((book) =>
      book.id === bookId ? { ...book, title: title.trim() || "未命名书本", updatedAt: new Date().toISOString() } : book
    )
  };
}

export function updateBookStatus(state: LibraryState, bookId: string, status: Book["status"]): LibraryState {
  return {
    ...state,
    books: state.books.map((book) =>
      book.id === bookId ? { ...book, status, updatedAt: new Date().toISOString() } : book
    )
  };
}

export function deleteBook(state: LibraryState, bookId: string): LibraryState {
  const { [bookId]: _volumes, ...volumes } = state.volumes;
  const { [bookId]: _chapters, ...chapters } = state.chapters;
  const { [bookId]: _materials, ...materials } = state.materials;
  return {
    ...state,
    books: state.books.filter((book) => book.id !== bookId),
    volumes,
    chapters,
    materials
  };
}

export function updateChapterContent(state: LibraryState, chapterId: string, content: string): LibraryState {
  const now = new Date().toISOString();

  return {
    ...state,
    chapters: mapChapter(state.chapters, chapterId, (chapter) => ({ ...chapter, content, updatedAt: now }))
  };
}

export function appendToChapter(state: LibraryState, chapterId: string, addition: string): LibraryState {
  const chapter = findChapter(state, chapterId);
  if (!chapter) return state;
  const current = chapter.content.trim();
  const nextContent = current ? `${current}\n\n${addition.trim()}` : addition.trim();

  return updateChapterContent(state, chapterId, nextContent);
}

export function updateChapterSummary(state: LibraryState, chapterId: string, summary: string): LibraryState {
  const now = new Date().toISOString();
  return {
    ...state,
    chapters: mapChapter(state.chapters, chapterId, (chapter) => ({ ...chapter, summary, summaryUpdatedAt: now }))
  };
}

export function replaceChapterRange(
  state: LibraryState,
  chapterId: string,
  range: { start: number; end: number },
  replacement: string
): LibraryState {
  const chapter = findChapter(state, chapterId);
  if (!chapter) return state;
  const start = Math.max(0, Math.min(range.start, chapter.content.length));
  const end = Math.max(start, Math.min(range.end, chapter.content.length));

  return updateChapterContent(state, chapterId, `${chapter.content.slice(0, start)}${replacement.trim()}${chapter.content.slice(end)}`);
}

export function updateMaterialFile(state: LibraryState, materialId: string, content: string): LibraryState {
  const now = new Date().toISOString();
  const nextMaterials = Object.fromEntries(
    Object.entries(state.materials).map(([bookId, files]) => [
      bookId,
      files.map((file) => (file.id === materialId ? { ...file, content, updatedAt: now } : file))
    ])
  ) as Record<string, MaterialFile[]>;

  return {
    ...state,
    materials: nextMaterials
  };
}

export function upsertSkill(state: LibraryState, skill: Pick<SkillTemplate, "id" | "name" | "prompt"> & Partial<Pick<SkillTemplate, "action">>): LibraryState {
  const now = new Date().toISOString();
  const existing = state.skills.find((item) => item.id === skill.id);
  const nextSkill: SkillTemplate = {
    ...skill,
    action: normalizeSkillAction(skill.action ?? existing?.action, skill.id),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  return {
    ...state,
    skills: existing
      ? state.skills.map((item) => (item.id === skill.id ? nextSkill : item))
      : [nextSkill, ...state.skills]
  };
}

export function normalizeSkillAction(action: unknown, skillId = ""): SkillAction {
  if (typeof action === "string" && VALID_SKILL_ACTIONS.has(action as SkillAction)) {
    return action as SkillAction;
  }
  return DEFAULT_SKILL_ACTIONS[skillId] ?? "appendText";
}

export function getBookVolumes(state: LibraryState, bookId: string): Volume[] {
  return [...(state.volumes[bookId] ?? [])].sort((a, b) => a.order - b.order);
}

export function getBookChapters(state: LibraryState, bookId: string): ChapterFile[] {
  return [...(state.chapters[bookId] ?? [])].sort((a, b) => a.order - b.order);
}

export function getVolumeChapters(state: LibraryState, volumeId: string): ChapterFile[] {
  return Object.values(state.chapters)
    .flat()
    .filter((ch) => ch.volumeId === volumeId)
    .sort((a, b) => a.order - b.order);
}

export function getBookMaterials(state: LibraryState, bookId: string): MaterialFile[] {
  return [...(state.materials[bookId] ?? [])];
}

export function getMaterialContent(state: LibraryState, bookId: string, kind: MaterialKind): string {
  return getBookMaterials(state, bookId).find((file) => file.kind === kind)?.content ?? "";
}

export function findChapter(state: LibraryState, chapterId: string): ChapterFile | undefined {
  return Object.values(state.chapters)
    .flat()
    .find((chapter) => chapter.id === chapterId);
}

export function findVolume(state: LibraryState, volumeId: string): Volume | undefined {
  return Object.values(state.volumes)
    .flat()
    .find((volume) => volume.id === volumeId);
}

export function findMaterial(state: LibraryState, materialId: string): MaterialFile | undefined {
  return Object.values(state.materials)
    .flat()
    .find((material) => material.id === materialId);
}

export function createMaterial(state: LibraryState, bookId: string, kind: MaterialKind, title: string): { state: LibraryState; material: MaterialFile } {
  const now = new Date().toISOString();
  const material: MaterialFile = {
    id: createId("material"),
    bookId,
    kind,
    title: title.trim() || kind,
    content: "",
    fields: [],
    tags: [],
    createdAt: now,
    updatedAt: now
  };
  return {
    material,
    state: {
      ...state,
      materials: {
        ...state.materials,
        [bookId]: [...(state.materials[bookId] ?? []), material]
      }
    }
  };
}

export function deleteMaterial(state: LibraryState, materialId: string): LibraryState {
  return {
    ...state,
    materials: Object.fromEntries(
      Object.entries(state.materials).map(([bookId, files]) => [
        bookId,
        files.filter((file) => file.id !== materialId)
      ])
    ) as Record<string, MaterialFile[]>
  };
}

export function createDefaultMaterials(
  bookId: string,
  timestamp = new Date().toISOString(),
  materials: Partial<Record<MaterialKind, string>> = {}
): MaterialFile[] {
  return materialDefinitions.map((definition) => ({
    id: `${bookId}-${definition.kind}`,
    bookId,
    kind: definition.kind,
    title: definition.title,
    content: materials[definition.kind]?.trim() ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

function createChapterFile(bookId: string, volumeId: string, title: string, order: number, content: string, timestamp: string): ChapterFile {
  return {
    id: createId("chapter"),
    bookId,
    volumeId,
    title,
    content,
    order,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function mapChapter(
  chapters: Record<string, ChapterFile[]>,
  chapterId: string,
  update: (chapter: ChapterFile) => ChapterFile
): Record<string, ChapterFile[]> {
  return Object.fromEntries(
    Object.entries(chapters).map(([bookId, files]) => [
      bookId,
      files.map((chapter) => (chapter.id === chapterId ? update(chapter) : chapter))
    ])
  ) as Record<string, ChapterFile[]>;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}