import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton, Notice } from "../src/components/Ui";
import { getSelectedBookData, useApp } from "../src/context/AppContext";
import { useTheme } from "../src/context/ThemeContext";
import { spacing, type ThemeColors } from "../src/theme";

export default function ChapterEditorScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ chapterId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selected = useMemo(
    () => getSelectedBookData(app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId),
    [app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId]
  );

  const chapterId = params.chapterId ?? app.selectedChapterId;
  const chapter = app.library.books
    .flatMap((book) => app.library.chapters[book.id] ?? [])
    .find((ch) => ch.id === chapterId) ?? selected.chapter;

  const [title, setTitle] = useState(chapter?.title ?? "");
  const [content, setContent] = useState(chapter?.content ?? "");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<TextInput>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chapterId && chapterId !== app.selectedChapterId) {
      app.selectChapter(chapterId);
    }
  }, [chapterId]);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content);
    }
  }, [chapter?.id]);

  const saveChanges = useCallback(async (newTitle: string, newContent: string) => {
    if (!chapter) return;
    setIsSaving(true);
    try {
      if (newTitle !== chapter.title) {
        await app.setChapterTitle(chapter.id, newTitle);
      }
      if (newContent !== chapter.content) {
        await app.setChapterContent(chapter.id, newContent);
      }
      setNotice("");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }, [chapter, app]);

  function debouncedSave(newTitle: string, newContent: string) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveChanges(newTitle, newContent);
    }, 600);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    debouncedSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    debouncedSave(title, value);
  }

  function handleSelectionChange(event: any) {
    if (chapter) {
      app.setChapterSelection(chapter.id, event.nativeEvent.selection);
    }
  }

  function goBack() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    Keyboard.dismiss();
    void saveChanges(title, content);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/novels");
    }
  }

  if (!chapter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton
            accessibilityLabel="返回"
            icon={<Ionicons name="chevron-back" size={24} color={colors.text} />}
            onPress={goBack}
          />
          <Text style={styles.headerTitle}>未找到章节</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>该章节不存在或已被删除。</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="返回"
          icon={<Ionicons name="chevron-back" size={24} color={colors.text} />}
          onPress={goBack}
        />
        <Text numberOfLines={1} style={styles.headerTitle}>{chapter.title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <Notice message={notice || app.error} tone={notice.includes("失败") ? "error" : "success"} />

      <View style={styles.editorArea}>
        <View style={styles.titleFieldWrap}>
          <Text style={styles.titleLabel}>章节名</Text>
          <TextInput
            accessibilityLabel="编辑章节名"
            value={title}
            onChangeText={handleTitleChange}
            placeholder="输入章节名"
            placeholderTextColor={colors.muted}
            style={styles.titleInput}
          />
        </View>

        <View style={styles.contentFieldWrap}>
          <View style={styles.contentLabelRow}>
            <Text style={styles.titleLabel}>正文</Text>
            <Text style={styles.wordCount}>{content.length} 字</Text>
          </View>
          <TextInput
            ref={contentRef}
            accessibilityLabel="编辑正文"
            multiline
            value={content}
            onChangeText={handleContentChange}
            onSelectionChange={handleSelectionChange}
            placeholder="从这里编辑正文。选中文字后，可在 AI 对话里替换或续写。"
            placeholderTextColor={colors.muted}
            style={styles.contentInput}
          />
        </View>
      </View>

      {isSaving ? (
        <View style={styles.savingBar}>
          <Text style={styles.savingText}>正在保存…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.md
    },
    headerTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center"
    },
    headerPlaceholder: {
      minWidth: 44
    },
    editorArea: {
      flex: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    titleFieldWrap: {
      gap: spacing.xs
    },
    titleLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    titleInput: {
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.input,
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md
    },
    contentFieldWrap: {
      flex: 1,
      gap: spacing.xs
    },
    contentLabelRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    wordCount: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "600"
    },
    contentInput: {
      flex: 1,
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.input,
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
      padding: spacing.md,
      textAlignVertical: "top"
    },
    savingBar: {
      alignItems: "center",
      paddingVertical: spacing.xs,
      backgroundColor: colors.surfaceAlt
    },
    savingText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "600"
    },
    emptyBody: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl
    },
    emptyText: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center"
    }
  });
}