import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton, Notice } from "../src/components/Ui";
import { getSelectedBookData, useApp } from "../src/context/AppContext";
import { useTheme } from "../src/context/ThemeContext";
import { spacing, type ThemeColors } from "../src/theme";
import type { MaterialFile } from "../src/types";

function materialTitle(material: MaterialFile, index: number): string {
  if (material.kind === "worldbuilding") return "作品设定";
  if (material.kind === "plotOutline") return "作品大纲";
  if (material.kind === "characters") return "角色设定";
  if (material.kind === "chapterSummary") return "灵感记录";
  return material.title || `资料${index + 1}`;
}

export default function MaterialEditorScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ materialId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selected = useMemo(
    () => getSelectedBookData(app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId),
    [app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId]
  );

  const materialId = params.materialId ?? app.selectedMaterialId;
  const material = app.library.books
    .flatMap((book) => app.library.materials[book.id] ?? [])
    .find((m) => m.id === materialId) ?? selected.material;

  const materialIndex = selected.materials.findIndex((m) => m.id === material?.id);

  const [content, setContent] = useState(material?.content ?? "");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (materialId && materialId !== app.selectedMaterialId) {
      app.selectMaterial(materialId);
    }
  }, [materialId]);

  useEffect(() => {
    if (material) {
      setContent(material.content);
    }
  }, [material?.id]);

  const saveChanges = useCallback(async (newContent: string) => {
    if (!material) return;
    setIsSaving(true);
    try {
      await app.setMaterialContent(material.id, newContent);
      setNotice("");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }, [material, app]);

  function debouncedSave(newContent: string) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveChanges(newContent);
    }, 600);
  }

  function handleContentChange(value: string) {
    setContent(value);
    debouncedSave(value);
  }

  function goBack() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    Keyboard.dismiss();
    void saveChanges(content);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/novels");
    }
  }

  const displayTitle = material ? materialTitle(material, materialIndex) : "资料";

  if (!material) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton
            accessibilityLabel="返回"
            icon={<Ionicons name="chevron-back" size={24} color={colors.text} />}
            onPress={goBack}
          />
          <Text style={styles.headerTitle}>未找到资料</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>该资料不存在或已被删除。</Text>
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
        <Text numberOfLines={1} style={styles.headerTitle}>{displayTitle}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <Notice message={notice || app.error} tone={notice.includes("失败") ? "error" : "success"} />

      <View style={styles.editorArea}>
        <View style={styles.contentLabelRow}>
          <Text style={styles.titleLabel}>{displayTitle}</Text>
          <Text style={styles.wordCount}>{content.length} 字</Text>
        </View>
        <TextInput
          accessibilityLabel={displayTitle}
          multiline
          value={content}
          onChangeText={handleContentChange}
          placeholder="记录设定、大纲、角色或灵感。"
          placeholderTextColor={colors.muted}
          style={styles.contentInput}
        />
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
      gap: spacing.xs,
      padding: spacing.lg
    },
    contentLabelRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    titleLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
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