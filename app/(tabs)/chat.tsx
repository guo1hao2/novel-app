import { Ionicons } from "@expo/vector-icons";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Button,
  CardButton,
  ChatBubble,
  ChatComposer,
  ConfirmDialog,
  HorizontalList,
  IconButton,
  Notice,
  Pill,
  Screen,
  Section,
  TopBar
} from "../../src/components/Ui";
import { HistorySidebar } from "../../src/components/HistorySidebar";
import { loadConversationMessages, updateConversationTitle } from "../../src/storage/sqliteRepository";
import { getSelectedBookData, useApp } from "../../src/context/AppContext";
import { useTheme } from "../../src/context/ThemeContext";
import { requestChatCompletion, requestChatCompletionStream } from "../../src/features/ai/apiClient";
import {
  advanceToStep,
  appendOnboardingAssistantReply,
  appendUserMessageOnly,
  buildCombinedGenreReplyMessages,
  buildFinalizeBookMessages,
  buildOnboardingReplyMessages,
  buildOptionRetryMessages,
  createInitialOnboardingConversation,
  formatOnboardingMaterials,
  getStepQuestion,
  normalizeOptions,
  padOptionsWithFallback,
  parseCombinedGenreReply,
  parseFinalBookPlan,
  parseOnboardingReply,
  summarizeOnboardingAnswers,
  validateOnboardingAnswer,
  type OnboardingChatMessage,
  type OnboardingConversation,
  type OnboardingReplyOption,
  type OnboardingStep,
  type StyleSuggestionResult
} from "../../src/features/ai/bookOnboarding";
import {
  buildMaterialUpdateMessages,
  parseMaterialUpdateResult
} from "../../src/features/ai/continuationPipeline";
import { buildOptimizedContext } from "../../src/features/ai/contextOptimizer";
import { spacing, type ThemeColors } from "../../src/theme";
import type { ChatMessage, MaterialFile, MaterialKind, SkillAction } from "../../src/types";

type ChatMode = "createBook" | "continue" | null;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ChatScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[]; bookId?: string | string[] }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [isFinalizingBook, setIsFinalizingBook] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState("");
  const [pendingOption, setPendingOption] = useState<OnboardingReplyOption | null>(null);
  const [replyOptions, setReplyOptions] = useState<OnboardingReplyOption[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState(app.library.skills[0]?.id ?? "");
  const [styleResult, setStyleResult] = useState<StyleSuggestionResult | null>(null);
  const pendingDraftRef = useRef<{ instruction: string; action: SkillAction } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onboardingRunRef = useRef(0);

  const onboarding = app.onboarding;
  const routeMode = normalizeParam(params.mode);
  const mode: ChatMode = routeMode === "createBook" || routeMode === "continue" ? routeMode : null;
  const routeBookId = normalizeParam(params.bookId);
  const routeBook = app.library.books.find((book) => book.id === routeBookId);
  const selected = useMemo(
    () => getSelectedBookData(app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId),
    [app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId]
  );
  const selectedSkill = app.library.skills.find((skill) => skill.id === selectedSkillId) ?? app.library.skills[0];
  const activeBookReady = Boolean(routeBook && selected.book?.id === routeBook.id);
  const hasApiKey = Boolean(app.apiKey.trim());
  const isBusy = isThinking || isFinalizingBook || isGenerating;
  const lastAssistantMessageIndex = onboarding.messages.reduce(
    (lastIndex, message, index) => (message.role === "assistant" ? index : lastIndex),
    -1
  );

  useEffect(() => {
    if (!selectedSkillId && app.library.skills[0]) {
      setSelectedSkillId(app.library.skills[0].id);
    }
  }, [app.library.skills, selectedSkillId]);

  useEffect(() => {
    if (!app.isReady || mode !== "continue" || !routeBookId) return;
    if (!routeBook) {
      setNotice("找不到要续写的书本，请重新选择。");
      router.replace("/chat?mode=continue");
      return;
    }
    if (app.selectedBookId !== routeBook.id) {
      app.selectBook(routeBook.id);
    }
  }, [app, app.isReady, app.selectedBookId, mode, routeBook, routeBookId, router]);

  useEffect(() => {
    if (mode !== "continue" || !app.currentConversationId) {
      setLoadedMessages([]);
      return;
    }
    loadConversationMessages(app.currentConversationId).then(setLoadedMessages);
  }, [app.currentConversationId, mode]);

  function startCreateBook() {
    setNotice("");
    setComposerValue("");
    router.push("/chat?mode=createBook");
  }

  function startContinue() {
    setNotice("");
    setComposerValue("");
    if (!app.library.books.length) {
      setNotice("还没有可续写的书本，请先新建书本。");
      return;
    }
    router.push("/continuation");
  }

  function returnToEntry() {
    setNotice("");
    setComposerValue("");
    router.push("/chat");
  }

  async function sendComposerValue(value = composerValue) {
    if (mode === "createBook") {
      await sendOnboardingMessage(value);
      return;
    }
    if (mode === "continue") {
      await sendContinueMessage(value);
    }
  }

  async function ensureFourOptionsLocal(
    rawOptions: OnboardingReplyOption[],
    nextStep: OnboardingStep,
    conversation: OnboardingConversation,
    userAnswer: string,
    aiReply: string
  ): Promise<OnboardingReplyOption[]> {
    if (nextStep === "complete") return [];
    const normalized = normalizeOptions(rawOptions);
    if (normalized.length >= 4) return normalized;

    try {
      const neededCount = 4 - normalized.length;
      const retryMessages = buildOptionRetryMessages({
        step: nextStep,
        currentQuestion: getStepQuestion(nextStep, styleResult),
        userAnswer,
        collectedAnswers: conversation.answers,
        firstReply: aiReply,
        firstOptions: normalized,
        neededCount
      });
      const retryContent = await requestChatCompletion({
        provider: app.provider,
        apiKey: app.apiKey,
        messages: retryMessages,
        responseFormat: { type: "json_object" }
      });
      const retryParsed = parseOnboardingReply(retryContent);
      const retryNormalized = normalizeOptions(retryParsed.options);
      const seen = new Set(normalized.map((o) => o.label.toLowerCase()));
      const merged = [...normalized];
      for (const opt of retryNormalized) {
        if (seen.has(opt.label.toLowerCase())) continue;
        seen.add(opt.label.toLowerCase());
        merged.push(opt);
        if (merged.length >= 4) break;
      }
      if (merged.length >= 4) return merged.slice(0, 4);
    } catch {
      // Retry failed silently; fall through to local fallback
    }

    return padOptionsWithFallback(normalized, nextStep);
  }

  async function sendOnboardingMessage(rawValue: string) {
    const answer = rawValue.trim();
    if (!answer) return;
    if (onboarding.isComplete) {
      setNotice("书本资料正在生成中，请稍候…");
      return;
    }
    if (!hasApiKey) {
      setNotice("请先在设置页保存 API Key，新建书本的每一轮 AI 回复都需要调用 DeepSeek。");
      return;
    }

    const isKnownOption = replyOptions.some((opt) => opt.label.trim() === answer);
    if (!isKnownOption) {
      const validation = validateOnboardingAnswer(onboarding.step, answer);
      if (!validation.valid) {
        setNotice(validation.reason);
        setComposerValue("");
        return;
      }
    }

    const runId = onboardingRunRef.current + 1;
    onboardingRunRef.current = runId;
    const previous = onboarding;
    // 只追加用户消息，不推进步骤
    const withUserMsg = appendUserMessageOnly(previous, answer);
    setComposerValue("");
    setPendingOption(null);
    setReplyOptions([]);
    setNotice("");
    app.setOnboarding(withUserMsg);
    setIsThinking(true);
    setThinkingExpanded(false);
    setThinkingSteps(["已记录你的回答", "准备调用 AI 生成回复"]);

    try {
      if (previous.step === "genre") {
        // genre 步骤：一次合并调用（回复 + 风格候选 + 后续问题）
        addThinkingStep("正在判断回答并生成风格选项");
        const combinedContent = await requestChatCompletion({
          provider: app.provider,
          apiKey: app.apiKey,
          messages: buildCombinedGenreReplyMessages({ conversation: previous, answer }),
          responseFormat: { type: "json_object" }
        });
        if (runId !== onboardingRunRef.current) return;
        const combined = parseCombinedGenreReply(combinedContent);
        if (combined.styleSuggestions) {
          setStyleResult(combined.styleSuggestions);
        }
        const actualNextStep = combined.replyResult.nextStep ?? "style";
        const advanced = advanceToStep(withUserMsg, answer, actualNextStep);
        const withReply = appendOnboardingAssistantReply(advanced, combined.replyResult);
        app.setOnboarding(withReply);
        const normalizedGenreOptions = await ensureFourOptionsLocal(
          combined.replyResult.options,
          actualNextStep,
          previous,
          answer,
          combined.replyResult.reply
        );
        setReplyOptions(normalizedGenreOptions);
        addThinkingStep("AI 回复已生成");
      } else {
        // 其他步骤：单次调用，由 AI 决定是否推进
        addThinkingStep("正在组织 AI 回复");
        const replyContent = await requestChatCompletion({
          provider: app.provider,
          apiKey: app.apiKey,
          messages: buildOnboardingReplyMessages({
            conversation: previous,
            answer,
            styleSuggestions: styleResult
          }),
          responseFormat: { type: "json_object" }
        });
        if (runId !== onboardingRunRef.current) return;
        const reply = parseOnboardingReply(replyContent);
        const actualNextStep = reply.nextStep ?? getNextStepFallback(previous.step);
        const advanced = advanceToStep(withUserMsg, answer, actualNextStep);
        const withReply = appendOnboardingAssistantReply(advanced, reply);
        app.setOnboarding(withReply);
        const normalizedOptions = await ensureFourOptionsLocal(
          reply.options,
          actualNextStep,
          previous,
          answer,
          reply.reply
        );
        setReplyOptions(normalizedOptions);
        addThinkingStep("AI 回复已生成");

        if (advanced.isComplete) {
          await finalizeBookFromConversation(withReply);
        }
      }
    } catch (caught) {
      addThinkingStep("请求失败，请调整回答后重试");
      setNotice(caught instanceof Error ? caught.message : "生成 AI 回复失败。");
    } finally {
      if (runId === onboardingRunRef.current) {
        setIsThinking(false);
      }
    }
  }

  async function finalizeBookFromConversation(conversation: OnboardingConversation) {
    if (!hasApiKey) {
      setNotice("请先在设置页保存 API Key。");
      return;
    }

    setIsFinalizingBook(true);
    setNotice("");
    addThinkingStep("正在整理书名、简介和资料库文件");
    try {
      const answers = summarizeOnboardingAnswers(conversation.answers);
      const matchedStyle = styleResult?.styles.find((style) => style.name === answers.styleName);
      const content = await requestChatCompletion({
        provider: app.provider,
        apiKey: app.apiKey,
        messages: buildFinalizeBookMessages({
          ...answers,
          workingTitle: extractWorkingTitle(answers.genre),
          styleDescription: matchedStyle?.description ?? answers.styleDescription,
          customStyle: matchedStyle ? "" : answers.styleName
        }),
        responseFormat: { type: "json_object" }
      });
      const plan = parseFinalBookPlan(content);
      addThinkingStep("资料库内容已整理完成");
      const bookId = await app.addBook({
        title: plan.title,
        summary: plan.summary,
        materials: formatOnboardingMaterials(plan)
      });
      setNotice("书本已创建，资料库也已经写入，可以开始续写。");
      app.resetOnboarding();
      setLoadedMessages([]);
      router.push(`/continuation-chat?bookId=${encodeURIComponent(bookId)}`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "创建书本失败。");
    } finally {
      setIsFinalizingBook(false);
    }
  }

  async function sendContinueMessage(rawValue: string) {
    const instruction = rawValue.trim();
    if (!instruction) return;
    if (!routeBook || !activeBookReady || !selectedSkill || !app.currentConversationId) {
      setNotice("请先选择书本、技能，并确保有活动对话。");
      return;
    }
    if (!hasApiKey) {
      setNotice("请先在设置页保存 API Key。");
      return;
    }

    const targetChapter = selected.chapters[selected.chapters.length - 1];
    setComposerValue("");
    setNotice("");
    setIsThinking(true);
    setIsGenerating(false);
    setThinkingExpanded(false);
    setThinkingSteps(["读取资料库"]);
    const previousDraft = assistantDraft.trim();
    setAssistantDraft("");
    const userMessage = createMessage(routeBook.id, app.currentConversationId, "user", instruction);
    setLoadedMessages((messages) => [...messages, userMessage]);

    try {
      await app.persistChatMessage(userMessage);

      // Auto-title logic
      if (app.currentConversationId) {
        const conv = app.conversations.find((c) => c.id === app.currentConversationId);
        if (conv && !conv.title) {
          const autoTitle = instruction.slice(0, 20) + (instruction.length > 20 ? "..." : "");
          await updateConversationTitle(app.currentConversationId, autoTitle);
          await app.refreshConversations();
        }
      }

      const materials = await app.ensureBookMaterials(routeBook.id);
      const materialInput = {
        bookTitle: routeBook.title,
        chapterTitle: targetChapter.title,
        worldbuilding: getMaterialContentFromFiles(materials, "worldbuilding"),
        characters: getMaterialContentFromFiles(materials, "characters"),
        plotOutline: getMaterialContentFromFiles(materials, "plotOutline"),
        chapterSummary: getMaterialContentFromFiles(materials, "chapterSummary"),
        userInstruction: instruction
      };

      if (selectedSkill.action === "updateMaterials") {
        addThinkingStep("正在根据已确认正文更新资料库");
        const materialContent = await requestChatCompletion({
          provider: app.provider,
          apiKey: app.apiKey,
          messages: buildMaterialUpdateMessages({
            ...materialInput,
            confirmedChapterContent: targetChapter.content,
            userInstruction: `${selectedSkill.prompt}\n\n${instruction}`.trim()
          }),
          responseFormat: { type: "json_object" }
        });
        const materialUpdate = parseMaterialUpdateResult(materialContent);
        await app.setBookMaterialContents(routeBook.id, materialUpdate);
        const assistantMessage = createMessage(routeBook.id, app.currentConversationId, "assistant", "资料库已根据当前章节更新。");
        await app.persistChatMessage(assistantMessage);
        setLoadedMessages((messages) => [...messages, assistantMessage]);
        setNotice("资料库已更新。");
        addThinkingStep("资料库已更新");
        setIsThinking(false);
        return;
      }

      addThinkingStep("准备生成待确认草稿");
      setIsThinking(false);
      setIsGenerating(true);

      const messages = buildOptimizedContext({
        ...materialInput,
        chapterSummaries: selected.chapters.map((chapter) => ({
          chapterId: chapter.id,
          title: chapter.title,
          summary: chapter.summary ?? "",
          order: chapter.order
        })),
        currentChapterContent: targetChapter.content,
        skillName: selectedSkill.name,
        skillPrompt: selectedSkill.prompt,
        previousDraft
      });

      abortControllerRef.current = requestChatCompletionStream(
        {
          provider: app.provider,
          apiKey: app.apiKey,
          messages
        },
        {
          onToken(token) {
            setAssistantDraft((prev) => prev + token);
          },
          async onComplete(fullText) {
            const assistantMessage = createMessage(routeBook.id, app.currentConversationId ?? "", "assistant", fullText);
            await app.persistChatMessage(assistantMessage);
            setLoadedMessages((messages) => [...messages, assistantMessage]);
            setAssistantDraft(fullText);
            pendingDraftRef.current = { instruction, action: selectedSkill.action };
            setIsGenerating(false);
            addThinkingStep("正文草稿已生成，等待确认");
            abortControllerRef.current = null;
          },
          onError(error) {
            setNotice(error.message);
            setIsGenerating(false);
            abortControllerRef.current = null;
          }
        }
      );
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "AI 请求失败。");
      setIsGenerating(false);
      setIsThinking(false);
    }
  }

  function cancelStream() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setIsThinking(false);
    setNotice("已取消生成。");
  }

  async function confirmDraft() {
    const targetChapter = selected.chapters[selected.chapters.length - 1];
    if (!targetChapter || !assistantDraft) return;
    const draft = assistantDraft;
    const pending = pendingDraftRef.current;
    const action = pending?.action ?? selectedSkill?.action ?? "appendText";
    const instruction = pending?.instruction ?? "";

    try {
      let confirmedChapterContent = "";
      if (action === "appendText") {
        confirmedChapterContent = appendDraftToContent(targetChapter.content, draft);
        await app.appendAssistantText(targetChapter.id, draft);
      } else if (action === "replaceSelection") {
        confirmedChapterContent = replaceDraftInContent(targetChapter.id, targetChapter.content, app.chapterSelection, draft);
        await app.replaceSelectedChapterText(targetChapter.id, draft);
      } else if (action === "chatOnly") {
        setAssistantDraft("");
        pendingDraftRef.current = null;
        setThinkingSteps([]);
        setNotice("AI 输出已保留在对话中，未修改章节正文。");
        return;
      }

      setAssistantDraft("");
      pendingDraftRef.current = null;
      setThinkingSteps(["正文已写入，正在同步资料库"]);
      setNotice(action === "replaceSelection" ? "AI 输出已替换选中文本。" : "AI 输出已写入当前章节末尾。");
      await syncMaterialsAfterConfirmedText(confirmedChapterContent, instruction);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "确认草稿失败。");
    }
  }

  async function syncMaterialsAfterConfirmedText(confirmedChapterContent: string, instruction: string) {
    const targetChapter = selected.chapters[selected.chapters.length - 1];
    if (!routeBook || !targetChapter) return;
    try {
      const materials = await app.ensureBookMaterials(routeBook.id);
      const materialContent = await requestChatCompletion({
        provider: app.provider,
        apiKey: app.apiKey,
        messages: buildMaterialUpdateMessages({
          bookTitle: routeBook.title,
          chapterTitle: targetChapter.title,
          worldbuilding: getMaterialContentFromFiles(materials, "worldbuilding"),
          characters: getMaterialContentFromFiles(materials, "characters"),
          plotOutline: getMaterialContentFromFiles(materials, "plotOutline"),
          chapterSummary: getMaterialContentFromFiles(materials, "chapterSummary"),
          confirmedChapterContent,
          userInstruction: instruction
        }),
        responseFormat: { type: "json_object" }
      });
      const materialUpdate = parseMaterialUpdateResult(materialContent);
      await app.setBookMaterialContents(routeBook.id, materialUpdate);
      setThinkingSteps([]);
      setNotice("正文已写入，资料库已同步。");
    } catch (caught) {
      setThinkingSteps([]);
      setNotice(caught instanceof Error ? `正文已写入，资料库同步失败：${caught.message}` : "正文已写入，资料库同步失败，可手动补全资料。");
    }
  }

  function showImagePlaceholder() {
    setNotice("插入图片功能即将支持。");
  }

  const [showResetDialog, setShowResetDialog] = useState(false);

  function confirmResetCreateBook() {
    setShowResetDialog(true);
  }

  function resetCreateBookChat() {
    onboardingRunRef.current += 1;
    app.resetOnboarding();
    setAssistantDraft("");
    setComposerValue("");
    setNotice("");
    setPendingOption(null);
    setReplyOptions([]);
    setStyleResult(null);
    setIsThinking(false);
    setIsFinalizingBook(false);
    setThinkingExpanded(false);
    setThinkingSteps([]);
  }

  function addThinkingStep(step: string) {
    setThinkingSteps((steps) => (steps.at(-1) === step ? steps : [...steps, step]));
  }

  const title = mode === "createBook" ? "新建书本" : mode === "continue" ? "续写" : "AI 对话";
  const subtitle = mode === "continue" && routeBook ? routeBook.title : "把灵感变成可持续写作的资料";
  const chatFooter =
    mode === "createBook" ? (
      <View style={styles.footerStack}>
        <ChatComposer
          disabled={isBusy || onboarding.isComplete}
          loading={isThinking || isFinalizingBook}
          onChangeText={(value) => {
            setPendingOption(null);
            setComposerValue(value);
          }}
          onSend={() => void sendComposerValue()}
          placeholder="直接回复 AI 的问题..."
          value={composerValue}
        />
      </View>
    ) : mode === "continue" && routeBook && activeBookReady ? (
      <View style={styles.footerStack}>
        {app.library.skills.length > 0 ? (
          <HorizontalList>
            {app.library.skills.map((skill) => (
              <Pill key={skill.id} title={skill.name} active={(selectedSkill?.id ?? selectedSkillId) === skill.id} onPress={() => setSelectedSkillId(skill.id)} />
            ))}
          </HorizontalList>
        ) : null}
        {assistantDraft ? (
          <Pressable accessibilityRole="button" onPress={confirmDraft} style={({ pressed }) => [styles.confirmDraftButton, pressed ? styles.replyOptionPressed : null]}>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.confirmDraftText}>确认写入章节</Text>
          </Pressable>
        ) : null}
        <ChatComposer
          disabled={isGenerating || isThinking || !app.currentConversationId}
          leadingAccessory={<ImagePlaceholderButton onPress={showImagePlaceholder} />}
          loading={isGenerating || isThinking}
          onChangeText={setComposerValue}
          onSend={() => void sendComposerValue()}
          placeholder="输入写作指令..."
          value={composerValue}
        />
        {isGenerating ? <Button title="取消生成" onPress={cancelStream} variant="secondary" /> : null}
      </View>
    ) : null;

  return (
    <>
      <Screen
        footer={chatFooter}
        stickyHeader={
          mode === "createBook" ? (
            <View style={styles.stickyHeaderContent}>
              <TopBar
                title={title}
                subtitle={subtitle}
                left={
                  <IconButton
                    accessibilityLabel="返回入口"
                    icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
                    onPress={returnToEntry}
                  />
                }
                right={
                  <IconButton
                    accessibilityLabel="重置新建书本"
                    icon={<Ionicons name="refresh" size={20} color={colors.text} />}
                    onPress={confirmResetCreateBook}
                  />
                }
              />
              <StepIndicator currentStep={onboarding.step} />
            </View>
          ) : undefined
        }
      >
        {mode === "continue" && routeBook && activeBookReady ? (
          <TopBar
            title="续写"
            subtitle={routeBook.title}
            left={
              <IconButton
                accessibilityLabel="返回入口"
                icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
                onPress={returnToEntry}
              />
            }
            right={
              <View style={{ flexDirection: "row", gap: 4 }}>
                <IconButton
                  accessibilityLabel="新建对话"
                  icon={<Ionicons name="add-circle-outline" size={22} color={colors.primary} />}
                  onPress={() => void app.createNewConversation()}
                />
                <IconButton
                  accessibilityLabel="历史对话"
                  icon={<Ionicons name="time-outline" size={22} color={colors.text} />}
                  onPress={() => setSidebarVisible(true)}
                />
              </View>
            }
          />
        ) : mode !== "createBook" ? (
          <TopBar
            title={title}
            subtitle={subtitle}
            left={
              mode ? (
                <IconButton
                  accessibilityLabel="返回入口"
                  icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
                  onPress={returnToEntry}
                />
              ) : null
            }
          />
        ) : null}

        <Notice message={notice || app.error} tone={isErrorNotice(notice || app.error) ? "error" : "success"} />

        {!mode ? (
          <View style={styles.entryStack}>
            <ChatBubble role="assistant">今天想从哪里开始？我可以先陪你搭一本新书，也可以读当前资料继续写。</ChatBubble>
            <CardButton
              title="新建书本"
              body="用几轮对话收集类型、风格、主角、冲突和开篇方向。"
              onPress={startCreateBook}
              icon={<Ionicons name="sparkles-outline" size={24} color={colors.primary} />}
            />
            <CardButton
              title="续写"
              body="先选择已有书本，再进入当前章节的聊天式续写。"
              onPress={startContinue}
              icon={<Ionicons name="create-outline" size={24} color={colors.primary} />}
            />
          </View>
        ) : null}

        {mode === "createBook" ? (
          <View style={styles.chatSurface}>
            <View style={styles.messages}>
              {onboarding.messages.map((message, index) => (
                <AssistantMessageBlock
                  key={message.id}
                  disabled={isBusy}
                  message={message}
                  onConfirm={(option) => void sendComposerValue(option.label)}
                  onSelect={setPendingOption}
                  options={replyOptions}
                  pendingOption={pendingOption}
                  showOptions={
                    message.role === "assistant" &&
                    index === lastAssistantMessageIndex &&
                    replyOptions.length > 0 &&
                    !isThinking &&
                    !isFinalizingBook &&
                    !onboarding.isComplete
                  }
                  step={onboarding.step}
                />
              ))}
              {isThinking || isFinalizingBook ? (
                <ThoughtPanel
                  active
                  expanded={thinkingExpanded}
                  onToggle={() => setThinkingExpanded((value) => !value)}
                  steps={thinkingSteps}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {mode === "continue" && !routeBook ? (
          <View style={styles.chatSurface}>
            <ChatBubble role="assistant">请先在书架中选择一本书。</ChatBubble>
            <Button title="去书架选择" onPress={() => router.replace("/(tabs)/novels")} />
          </View>
        ) : null}

        {mode === "continue" && routeBook && activeBookReady ? (
          <>
            <View style={styles.chatSurface}>
              <View style={styles.messages}>
                {!app.currentConversationId ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>选择技能，输入指令开始创作</Text>
                  </View>
                ) : loadedMessages.length === 0 && !isGenerating && !isThinking ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>输入指令开始创作</Text>
                  </View>
                ) : null}
                {loadedMessages.map((message) => (
                  <ChatBubble key={message.id} role={message.role}>
                    {message.content}
                  </ChatBubble>
                ))}
                {(isThinking || isGenerating || thinkingSteps.length > 0) ? (
                  <ThoughtPanel
                    active={isThinking || isGenerating}
                    expanded={thinkingExpanded}
                    onToggle={() => setThinkingExpanded((value) => !value)}
                    steps={thinkingSteps}
                  />
                ) : null}
                {assistantDraft && (isGenerating || loadedMessages.at(-1)?.content !== assistantDraft) ? (
                  <ChatBubble role="assistant">
                    <Text style={styles.assistantText}>{assistantDraft}</Text>
                  </ChatBubble>
                ) : null}
              </View>
            </View>
            <HistorySidebar
              conversations={app.conversations}
              currentConversationId={app.currentConversationId}
              onSelect={(id) => void app.selectConversation(id)}
              onDelete={(id) => void app.deleteCurrentConversation(id)}
              onClose={() => setSidebarVisible(false)}
              onNewConversation={() => void app.createNewConversation()}
              bookTitle={routeBook.title}
              visible={sidebarVisible}
            />
          </>
        ) : null}
      </Screen>
      <ConfirmDialog
        visible={showResetDialog}
        title="重置新建书本"
        message="当前所有对话和设置都会被清除，确定要重置吗？"
        confirmText="确认重置"
        onConfirm={() => { resetCreateBookChat(); setShowResetDialog(false); }}
        onCancel={() => setShowResetDialog(false)}
      />
    </>
  );
}

const ONBOARDING_STEPS: { key: OnboardingStep; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "genre", label: "类型", icon: "book-outline" },
  { key: "style", label: "风格", icon: "color-palette-outline" },
  { key: "protagonist", label: "主角", icon: "person-outline" },
  { key: "conflict", label: "冲突", icon: "flash-outline" },
  { key: "setting", label: "设定", icon: "globe-outline" },
  { key: "openingGoal", label: "开篇", icon: "rocket-outline" },
  { key: "complete", label: "完成", icon: "checkmark-circle-outline" }
];

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.key === currentStep);

  return (
    <View style={styles.stepIndicatorShell}>
      {ONBOARDING_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = step.key === currentStep;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                isCompleted ? styles.stepDotCompleted : null,
                isCurrent ? styles.stepDotCurrent : null
              ]}
            >
              <Ionicons
                name={isCompleted ? "checkmark" : step.icon}
                size={isCurrent ? 15 : 12}
                color={isCompleted || isCurrent ? "#FFFFFF" : colors.muted}
              />
            </View>
            {isCurrent ? (
              <Text style={styles.stepLabelCurrent} numberOfLines={1}>
                {step.label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function AssistantMessageBlock({
  disabled,
  message,
  onConfirm,
  onSelect,
  options,
  pendingOption,
  showOptions,
  step
}: {
  disabled: boolean;
  message: OnboardingChatMessage;
  onConfirm: (option: OnboardingReplyOption) => void;
  onSelect: (option: OnboardingReplyOption) => void;
  options: OnboardingReplyOption[];
  pendingOption: OnboardingReplyOption | null;
  showOptions: boolean;
  step: OnboardingStep;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAssistant = message.role === "assistant";
  const stepInfo = ONBOARDING_STEPS.find((s) => s.key === step);
  return (
    <View style={isAssistant ? styles.assistantBlock : styles.userBlock}>
      <View style={isAssistant ? styles.assistantRow : styles.userRow}>
        {isAssistant ? (
          <>
            <View style={styles.avatarAssistant}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <View style={styles.messageContent}>
              {stepInfo && stepInfo.key !== "complete" ? (
                <Text style={styles.messageStepTag}>第 {ONBOARDING_STEPS.findIndex((s) => s.key === step) + 1} 步 · {stepInfo.label}</Text>
              ) : null}
              <ChatBubble role={message.role}>{message.content}</ChatBubble>
            </View>
          </>
        ) : (
          <>
            <View style={styles.messageContent}>
              <ChatBubble role={message.role}>{message.content}</ChatBubble>
            </View>
            <View style={styles.avatarUser}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
          </>
        )}
      </View>
      {showOptions ? (
        <View style={styles.attachedOptions}>
          <ReplyOptionList
            disabled={disabled}
            onConfirm={onConfirm}
            onSelect={onSelect}
            options={options}
            pendingOption={pendingOption}
          />
        </View>
      ) : null}
    </View>
  );
}

function ThoughtPanel({
  active,
  expanded,
  onToggle,
  steps
}: {
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  steps: string[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibleSteps = steps.length ? steps : ["正在等待 DeepSeek 返回"];
  return (
    <View style={styles.thoughtShell}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={({ pressed }) => [styles.thoughtHeader, pressed ? styles.replyOptionPressed : null]}>
        <View style={styles.thinkingRow}>
          {active ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
          <View style={styles.thoughtTitleGroup}>
            <Text style={styles.thinkingText}>{active ? "AI 正在思考" : "AI 思考完成"}</Text>
            <Text style={styles.thoughtSubtitle}>可展开查看本轮公开处理过程</Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {expanded ? (
        <View style={styles.thoughtBody}>
          {visibleSteps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.thoughtStep}>
              <View style={[styles.thoughtDot, index === visibleSteps.length - 1 && active ? styles.thoughtDotActive : null]} />
              <Text style={styles.thoughtStepText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.thoughtFootnote}>这里只展示可公开的执行步骤，不展示隐藏推理内容。</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReplyOptionList({
  disabled,
  onConfirm,
  onSelect,
  options,
  pendingOption
}: {
  disabled: boolean;
  onConfirm: (option: OnboardingReplyOption) => void;
  onSelect: (option: OnboardingReplyOption) => void;
  options: OnboardingReplyOption[];
  pendingOption: OnboardingReplyOption | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeLabel = pendingOption?.label ?? "";
  const selectProgress = useRef(new Animated.Value(0)).current;
  const selectScale = selectProgress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1.026, 1.014]
  });
  const selectLift = selectProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2]
  });
  const selectGlowOpacity = selectProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08]
  });

  useEffect(() => {
    selectProgress.setValue(0);
    if (!activeLabel) return;
    Animated.spring(selectProgress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 13,
      mass: 0.75,
      stiffness: 190
    }).start();
  }, [activeLabel, selectProgress]);

  if (!options.length) return null;

  return (
    <View style={styles.optionList}>
      {options.map((option) => {
        const active = pendingOption?.label === option.label;
        return (
          <AnimatedPressable
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.replyOption,
              active ? { transform: [{ translateY: selectLift }, { scale: selectScale }] } : null,
              active ? styles.replyOptionActive : null,
              pressed ? styles.replyOptionPressed : null,
              disabled ? styles.disabledOption : null
            ]}
          >
            <Animated.View pointerEvents="none" style={[styles.optionSelectGlow, { opacity: active ? selectGlowOpacity : 0 }]} />
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>{option.label}</Text>
              <View style={styles.confirmOptionSlot}>
                {active ? (
                  <Pressable accessibilityRole="button" onPress={() => onConfirm(option)} style={({ pressed }) => [styles.confirmOptionButton, pressed ? styles.replyOptionPressed : null]}>
                    <Text style={styles.confirmOptionText}>确认选择</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
            {option.exampleSentence ? <Text style={styles.optionExample}>{option.exampleSentence}</Text> : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function ImagePlaceholderButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityLabel="插入图片（即将支持）"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.imageToolButton, pressed ? styles.replyOptionPressed : null]}
    >
      <Ionicons name="image-outline" size={20} color={colors.muted} />
    </Pressable>
  );
}

function createOptionCards(values: string[]): OnboardingReplyOption[] {
  return values.map((value) => ({
    label: value,
    description: "点击后会先进入确认状态，你也可以直接输入自定义回答。",
    exampleSentence: ""
  }));
}

function createMessage(bookId: string, conversationId: string, role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookId,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

function getMaterialContentFromFiles(materials: MaterialFile[], kind: MaterialKind): string {
  return materials.find((file) => file.kind === kind)?.content ?? "";
}

function appendDraftToContent(content: string, draft: string): string {
  const current = content.trim();
  return current ? `${current}\n\n${draft.trim()}` : draft.trim();
}

function replaceDraftInContent(
  chapterId: string,
  content: string,
  selection: { chapterId: string; start: number; end: number },
  draft: string
): string {
  if (selection.chapterId !== chapterId || selection.start === selection.end) {
    throw new Error("请先在章节编辑器中选中要替换的文字。");
  }
  const start = Math.max(0, Math.min(selection.start, content.length));
  const end = Math.max(start, Math.min(selection.end, content.length));
  return `${content.slice(0, start)}${draft.trim()}${content.slice(end)}`;
}

function extractWorkingTitle(value: string): string {
  const match = value.match(/(?:叫|名叫|书名|暂定)([^，。,.]+)/);
  return match?.[1]?.trim() ?? "";
}

function getNextStepFallback(step: OnboardingStep): OnboardingStep {
  if (step === "genre") return "style";
  if (step === "style") return "protagonist";
  if (step === "protagonist") return "conflict";
  if (step === "conflict") return "setting";
  if (step === "setting") return "openingGoal";
  return "complete";
}

function isErrorNotice(message: string): boolean {
  return message.includes("失败") || message.includes("请先") || message.includes("找不到") || message.includes("不足") || message.includes("无法");
}

function normalizeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stickyHeaderContent: {
      alignSelf: "center",
      maxWidth: 720,
      width: "100%",
      paddingHorizontal: spacing.lg
    },
    entryStack: {
      gap: spacing.md
    },
    chatSurface: {
      gap: spacing.md
    },
    messages: {
      gap: spacing.sm
    },
    assistantBlock: {
      alignSelf: "stretch",
      gap: spacing.xs
    },
    userBlock: {
      alignSelf: "stretch"
    },
    attachedOptions: {
      alignSelf: "flex-start",
      marginLeft: spacing.lg,
      marginTop: -2,
      width: "88%"
    },
    footerStack: {
      gap: spacing.sm
    },
    imageToolButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      opacity: 0.72,
      width: 40
    },
    assistantText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 23
    },
    thinkingRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm
    },
    thinkingText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "800"
    },
    thoughtShell: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      maxWidth: "88%",
      padding: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 2
    },
    thoughtHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between"
    },
    thoughtTitleGroup: {
      flex: 1,
      gap: 2
    },
    thoughtSubtitle: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16
    },
    thoughtBody: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: spacing.xs,
      marginTop: spacing.xs,
      paddingTop: spacing.sm
    },
    thoughtStep: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm
    },
    thoughtDot: {
      backgroundColor: colors.border,
      borderRadius: 5,
      height: 9,
      width: 9
    },
    thoughtDotActive: {
      backgroundColor: colors.primary
    },
    thoughtStepText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      lineHeight: 19
    },
    thoughtFootnote: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      paddingLeft: 17
    },
    optionList: {
      gap: spacing.sm
    },
    replyOption: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 18,
      backgroundColor: colors.surface,
      gap: spacing.xs,
      overflow: "hidden",
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2
    },
    replyOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      shadowOpacity: 0.12,
      elevation: 3
    },
    optionSelectGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primary,
      borderRadius: 18
    },
    replyOptionPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.99 }]
    },
    disabledOption: {
      opacity: 0.5
    },
    optionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between"
    },
    optionTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "900"
    },
    confirmOptionSlot: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      minWidth: 80
    },
    confirmOptionButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: spacing.md
    },
    confirmOptionText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900"
    },
    optionDescription: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19
    },
    optionExample: {
      color: colors.accent,
      fontSize: 13,
      lineHeight: 20
    },
    stepIndicatorShell: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    stepItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 3
    },
    stepDot: {
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 24,
      justifyContent: "center",
      width: 24
    },
    stepDotCompleted: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    stepDotCurrent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      borderRadius: 15,
      height: 30,
      width: 30
    },
    stepLabelCurrent: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800"
    },
    confirmDraftButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 999,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.xl
    },
    confirmDraftText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800"
    },
    assistantRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm
    },
    userRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end"
    },
    avatarAssistant: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      height: 28,
      justifyContent: "center",
      marginTop: 2,
      width: 28
    },
    avatarUser: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: 14,
      height: 28,
      justifyContent: "center",
      marginTop: 2,
      width: 28
    },
    messageContent: {
      flex: 1,
      gap: 2
    },
    messageStepTag: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      marginBottom: 2
    },
    emptyState: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingVertical: spacing.xxl
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14
    }
  });
}
