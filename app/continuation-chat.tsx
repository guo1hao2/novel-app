import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ChatBubble,
  ChatComposer,
  HorizontalList,
  IconButton,
  Notice,
  Pill,
  Screen,
  TopBar
} from "../src/components/Ui";
import { HistorySidebar } from "../src/components/HistorySidebar";
import { loadConversationMessages, updateConversationTitle } from "../src/storage/sqliteRepository";
import { getSelectedBookData, useApp } from "../src/context/AppContext";
import { useTheme } from "../src/context/ThemeContext";
import { requestChatCompletion, requestChatCompletionStream } from "../src/features/ai/apiClient";
import {
  buildMaterialUpdateMessages,
  parseMaterialUpdateResult
} from "../src/features/ai/continuationPipeline";
import { buildOptimizedContext } from "../src/features/ai/contextOptimizer";
import { spacing, type ThemeColors } from "../src/theme";
import type { ChatMessage, SkillAction } from "../src/types";

function createMessage(bookId: string, conversationId: string, role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookId,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

function getMaterialContentFromFiles(files: { kind: string; content: string }[], kind: string): string {
  return files.find((f) => f.kind === kind)?.content ?? "";
}

function appendDraftToContent(existing: string, draft: string): string {
  const separator = existing.trim() ? "\n\n" : "";
  return existing.trimEnd() + separator + draft;
}

export default function ContinuationChatScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bookId = params.bookId;
  const book = app.library.books.find((b) => b.id === bookId);
  const selected = useMemo(
    () => getSelectedBookData(app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId),
    [app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId]
  );

  const [assistantDraft, setAssistantDraft] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState(app.library.skills[0]?.id ?? "");
  const pendingDraftRef = useRef<{ instruction: string; action: SkillAction } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSkill = app.library.skills.find((skill) => skill.id === selectedSkillId) ?? app.library.skills[0];
  const hasApiKey = Boolean(app.apiKey.trim());
  const isBusy = isThinking || isGenerating;

  // Select the book on mount
  useEffect(() => {
    if (!app.isReady || !bookId) return;
    if (app.selectedBookId !== bookId) {
      app.selectBook(bookId);
    }
  }, [app, app.isReady, app.selectedBookId, bookId]);

  // Load conversation messages when conversation changes
  useEffect(() => {
    if (!app.currentConversationId) {
      setLoadedMessages([]);
      return;
    }
    loadConversationMessages(app.currentConversationId).then(setLoadedMessages);
  }, [app.currentConversationId]);

  // Auto-select first skill
  useEffect(() => {
    if (!selectedSkillId && app.library.skills[0]) {
      setSelectedSkillId(app.library.skills[0].id);
    }
  }, [app.library.skills, selectedSkillId]);

  function addThinkingStep(step: string) {
    setThinkingSteps((steps) => (steps.at(-1) === step ? steps : [...steps, step]));
  }

  async function sendMessage(rawValue: string) {
    const instruction = rawValue.trim();
    if (!instruction || !book || !selectedSkill || !app.currentConversationId) {
      setNotice("请先新建对话再开始写作。");
      return;
    }
    if (!hasApiKey) {
      setNotice("请先在设置页保存 API Key。");
      return;
    }

    const targetChapter = selected.chapters[selected.chapters.length - 1];
    if (!targetChapter) {
      setNotice("该书暂无章节，请先在书架中创建章节。");
      return;
    }

    setComposerValue("");
    setNotice("");
    setIsThinking(true);
    setThinkingExpanded(false);
    setThinkingSteps(["读取资料库"]);
    const previousDraft = assistantDraft.trim();
    setAssistantDraft("");
    const userMessage = createMessage(book.id, app.currentConversationId, "user", instruction);
    setLoadedMessages((messages) => [...messages, userMessage]);

    try {
      await app.persistChatMessage(userMessage);

      // Auto-title logic
      const conv = app.conversations.find((c) => c.id === app.currentConversationId);
      if (conv && !conv.title) {
        const autoTitle = instruction.slice(0, 20) + (instruction.length > 20 ? "..." : "");
        await updateConversationTitle(app.currentConversationId, autoTitle);
        await app.refreshConversations();
      }

      const materials = await app.ensureBookMaterials(book.id);
      const materialInput = {
        bookTitle: book.title,
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
        await app.setBookMaterialContents(book.id, materialUpdate);
        const assistantMessage = createMessage(book.id, app.currentConversationId, "assistant", "资料库已根据当前章节更新。");
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
            const assistantMessage = createMessage(book.id, app.currentConversationId ?? "", "assistant", fullText);
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
    if (!targetChapter || !assistantDraft || !book) return;
    const draft = assistantDraft;
    const pending = pendingDraftRef.current;
    const action = pending?.action ?? selectedSkill?.action ?? "appendText";
    const instruction = pending?.instruction ?? "";

    try {
      let confirmedChapterContent = "";
      if (action === "appendText") {
        confirmedChapterContent = appendDraftToContent(targetChapter.content, draft);
        await app.appendAssistantText(targetChapter.id, draft);
      } else if (action === "chatOnly") {
        setAssistantDraft("");
        pendingDraftRef.current = null;
        setThinkingSteps([]);
        setNotice("AI 输出已保留在对话中。");
        return;
      }

      setAssistantDraft("");
      pendingDraftRef.current = null;
      setThinkingSteps(["正文已写入，正在同步资料库"]);
      setNotice("AI 输出已写入当前章节末尾。");
      await syncMaterials(confirmedChapterContent, instruction);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "确认草稿失败。");
    }
  }

  async function syncMaterials(confirmedChapterContent: string, instruction: string) {
    const targetChapter = selected.chapters[selected.chapters.length - 1];
    if (!book || !targetChapter) return;
    try {
      const materials = await app.ensureBookMaterials(book.id);
      const materialContent = await requestChatCompletion({
        provider: app.provider,
        apiKey: app.apiKey,
        messages: buildMaterialUpdateMessages({
          bookTitle: book.title,
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
      await app.setBookMaterialContents(book.id, materialUpdate);
      setThinkingSteps([]);
      setNotice("正文已写入，资料库已同步。");
    } catch (caught) {
      setThinkingSteps([]);
      setNotice("正文已写入，资料库同步失败。");
    }
  }

  // Footer with skills above composer
  const chatFooter = book ? (
    <View style={styles.footerStack}>
      {app.library.skills.length > 0 ? (
        <View style={styles.skillRow}>
          <HorizontalList>
            {app.library.skills.map((skill) => (
              <Pill
                key={skill.id}
                title={skill.name}
                active={(selectedSkill?.id ?? selectedSkillId) === skill.id}
                onPress={() => setSelectedSkillId(skill.id)}
              />
            ))}
          </HorizontalList>
        </View>
      ) : null}
      {assistantDraft ? (
        <Pressable
          accessibilityRole="button"
          onPress={confirmDraft}
          style={({ pressed }) => [styles.confirmDraftButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.confirmDraftText}>确认写入章节</Text>
        </Pressable>
      ) : null}
      <ChatComposer
        disabled={isBusy || !app.currentConversationId}
        loading={isBusy}
        onChangeText={setComposerValue}
        onSend={() => void sendMessage(composerValue)}
        placeholder="输入写作指令..."
        value={composerValue}
      />
      {isGenerating ? (
        <Pressable
          accessibilityRole="button"
          onPress={cancelStream}
          style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.cancelButtonText}>取消生成</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  if (!book) {
    return (
      <Screen>
        <TopBar
          title="续写"
          subtitle="书本未找到"
          left={
            <IconButton
              accessibilityLabel="返回选书"
              icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
              onPress={() => router.replace("/continuation")}
            />
          }
        />
        <Notice message="找不到指定的书本，请重新选择。" tone="error" />
      </Screen>
    );
  }

  return (
    <>
      <Screen footer={chatFooter}>
        <TopBar
          title={book.title}
          subtitle="续写"
          left={
            <IconButton
              accessibilityLabel="返回选书"
              icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
              onPress={() => router.replace("/continuation")}
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

        <Notice
          message={notice || app.error}
          tone={isErrorNotice(notice || app.error) ? "error" : "success"}
        />

        <View style={styles.chatSurface}>
          <View style={styles.messages}>
            {!app.currentConversationId ? (
              <View style={styles.emptyState}>
                <Ionicons name="create-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyTitle}>开始创作</Text>
                <Text style={styles.emptyHint}>
                  点击右上角 + 新建对话，选择技能后输入写作指令。
                </Text>
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
            {isThinking || isGenerating || thinkingSteps.length > 0 ? (
              <ThoughtPanel
                active={isThinking || isGenerating}
                expanded={thinkingExpanded}
                onToggle={() => setThinkingExpanded((v) => !v)}
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
          bookTitle={book.title}
          visible={sidebarVisible}
        />
      </Screen>
    </>
  );
}

function isErrorNotice(message: string): boolean {
  return message.includes("失败") || message.includes("请先") || message.includes("找不到") || message.includes("不足") || message.includes("无法") || message.includes("错误");
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
  const styles = useMemo(() => createThoughtStyles(colors), [colors]);
  const visibleSteps = steps.length ? steps : ["正在等待 AI 返回"];

  return (
    <View style={styles.shell}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed ? { opacity: 0.7 } : null]}
      >
        <View style={styles.row}>
          {active ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          )}
          <View style={styles.titleGroup}>
            <Text style={styles.titleText}>{active ? "AI 正在思考" : "AI 思考完成"}</Text>
            <Text style={styles.subtitle}>可展开查看处理过程</Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          {visibleSteps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.stepRow}>
              <View style={[styles.dot, index === visibleSteps.length - 1 && active ? styles.dotActive : null]} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createThoughtStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shell: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: spacing.sm,
      overflow: "hidden"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1
    },
    titleGroup: { gap: 2 },
    titleText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    subtitle: {
      color: colors.muted,
      fontSize: 12
    },
    body: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.xs
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.muted
    },
    dotActive: {
      backgroundColor: colors.primary
    },
    stepText: {
      color: colors.muted,
      fontSize: 13
    }
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    footerStack: {
      gap: spacing.sm
    },
    skillRow: {
      paddingLeft: spacing.sm
    },
    confirmDraftButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.success,
      borderRadius: 12,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.sm
    },
    confirmDraftText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800"
    },
    cancelButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      marginHorizontal: spacing.sm
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    chatSurface: {
      flex: 1
    },
    messages: {
      gap: spacing.md,
      paddingBottom: spacing.xl
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxl,
      gap: spacing.md
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20
    },
    assistantText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22
    },
    pressed: {
      opacity: 0.7
    }
  });
}