import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, CardButton, ConfirmDialog, Field, FileRow, HorizontalList, IconButton, Notice, Pill, Row, Screen, Section, TopBar } from "../../src/components/Ui";
import { getSelectedBookData, useApp } from "../../src/context/AppContext";
import { useTheme } from "../../src/context/ThemeContext";
import { spacing, type ThemeColors } from "../../src/theme";
import type { Book, ChapterFile, Volume } from "../../src/types";

type ManagerView = "bookshelf" | "book" | "chapters" | "materials";

const BOOK_COVER_WIDTH = "46.5%";
const PALETTE = ["#4A90D9", "#E67E22", "#27AE60", "#8E44AD", "#E74C3C", "#1ABC9C", "#F39C12", "#2C3E50"];

function bookColor(book: Book): string {
  let hash = 0;
  for (let i = 0; i < book.id.length; i++) hash = book.id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function NovelsScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newVolumeTitle, setNewVolumeTitle] = useState("");
  const [targetVolumeId, setTargetVolumeId] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<ManagerView>("bookshelf");
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [deletingVolumeId, setDeletingVolumeId] = useState<string | null>(null);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => getSelectedBookData(app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId),
    [app.library, app.selectedBookId, app.selectedChapterId, app.selectedMaterialId]
  );

  const deletingBook = deletingBookId ? app.library.books.find((b) => b.id === deletingBookId) : null;
  const deletingVolume = deletingVolumeId ? selected.volumes.find((v) => v.id === deletingVolumeId) : null;

  async function createNewChapter() {
    if (!selected.book || !targetVolumeId) return;
    await app.addChapter(selected.book.id, targetVolumeId, newChapterTitle);
    setNewChapterTitle("");
    setNotice("章节已添加。");
    setExpandedVolumes((prev) => new Set(prev).add(targetVolumeId));
  }

  async function createNewVolume() {
    if (!selected.book) return;
    await app.addVolume(selected.book.id, newVolumeTitle);
    setNewVolumeTitle("");
    setNotice("卷已添加。");
  }

  function openBook(bookId: string) {
    app.selectBook(bookId);
    setView("book");
    setNotice("");
  }

  function goBack() {
    setView(view === "book" ? "bookshelf" : "book");
    setNotice("");
  }

  async function handleDeleteBook() {
    if (!deletingBookId) return;
    await app.deleteBook(deletingBookId);
    setDeletingBookId(null);
    setView("bookshelf");
    setNotice("书本已删除。");
  }

  async function handleDeleteVolume() {
    if (!deletingVolumeId) return;
    await app.deleteVolume(deletingVolumeId);
    setDeletingVolumeId(null);
    setNotice("卷已删除。");
  }

  function toggleVolume(volumeId: string) {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  }

  return (
    <Screen>
      <TopBar
        title={view === "bookshelf" ? "书架" : selected.book?.title ?? "书本"}
        subtitle={view === "bookshelf" ? "你的长篇项目库" : view === "book" ? "设定、章节和资料" : view === "chapters" ? "正文" : "资料库"}
        left={
          view !== "bookshelf" ? (
            <IconButton
              accessibilityLabel={view === "book" ? "返回书架" : "返回书本"}
              icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
              onPress={goBack}
            />
          ) : null
        }
      />
      <Notice message={notice || app.error} tone={isErrorNotice(notice || app.error) ? "error" : (notice ? "success" : "info")} />

      {view === "bookshelf" ? (
        <Section title="书架">
          {app.library.books.length ? (
            <View style={styles.shelfGrid}>
              {app.library.books.map((book) => (
                <BookCover
                  key={book.id}
                  book={book}
                  chapters={app.library.chapters[book.id] ?? []}
                  volumes={app.library.volumes[book.id] ?? []}
                  active={book.id === app.selectedBookId}
                  onPress={() => openBook(book.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>书架为空，去 AI 对话创建第一本书吧</Text>
          )}
        </Section>
      ) : null}

      {view === "book" && selected.book ? (
        <>
          <Section title="书本信息">
            <View style={styles.metaBox}>
              <View style={styles.metaHeader}>
                <View style={[styles.metaCover, { backgroundColor: bookColor(selected.book) }]}>
                  <Text numberOfLines={2} style={styles.metaCoverTitle}>
                    {selected.book.title}
                  </Text>
                </View>
                <View style={styles.metaInfo}>
                  <Text style={styles.metaTitle}>{selected.book.title}</Text>
                  <Text style={styles.metaText}>{selected.volumes.length} 卷 · {selected.chapters.length} 章 · {countWords(selected.chapters)} 字</Text>
                </View>
              </View>
            </View>

            <Field
              label="书名"
              value={selected.book.title}
              onChangeText={(value) => app.setBookTitle(selected.book!.id, value)}
              accessibilityLabel="编辑书名"
            />

            <Field
              label="简介"
              multiline
              value={selected.book.summary}
              onChangeText={(value) => app.setBookSummary(selected.book!.id, value)}
              accessibilityLabel="编辑书本简介"
            />

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>状态</Text>
              <HorizontalList>
                <Pill title="草稿" active={selected.book.status === "paused"} onPress={() => app.setBookStatus(selected.book!.id, "paused")} />
                <Pill title="写作中" active={selected.book.status === "drafting"} onPress={() => app.setBookStatus(selected.book!.id, "drafting")} />
                <Pill title="已完结" active={selected.book.status === "finished"} onPress={() => app.setBookStatus(selected.book!.id, "finished")} />
              </HorizontalList>
            </View>
          </Section>

          <Section title="文件夹">
            <CardButton
              title="正文"
              body={`${selected.volumes.length} 卷 · ${selected.chapters.length} 章`}
              onPress={() => setView("chapters")}
              icon={<Ionicons name="folder-open-outline" size={26} color={colors.accent} />}
            />
            <CardButton
              title="资料"
              body="世界观、人物关系、章节摘要"
              onPress={() => setView("materials")}
              icon={<Ionicons name="folder-outline" size={26} color={colors.accent} />}
            />
          </Section>

          <Section title="危险操作">
            <Button
              title="删除整本书"
              variant="danger"
              onPress={() => setDeletingBookId(selected.book!.id)}
            />
          </Section>
        </>
      ) : null}

      {view === "chapters" && selected.book ? (
        <>
          <Section title="添加新卷">
            <Row>
              <Field
                label="卷标题"
                value={newVolumeTitle}
                onChangeText={setNewVolumeTitle}
                placeholder={`第 ${selected.volumes.length + 1} 卷`}
                accessibilityLabel="卷标题"
                style={styles.inlineField}
              />
              <Button title="添加卷" onPress={createNewVolume} variant="secondary" disabled={!newVolumeTitle.trim()} />
            </Row>
          </Section>

          {selected.volumes.map((volume) => {
            const volumeChapters = selected.chapters.filter((ch) => ch.volumeId === volume.id);
            const isExpanded = expandedVolumes.has(volume.id);
            return (
              <Section key={volume.id} title={volume.title}>
                <View style={styles.volumeHeader}>
                  <Pressable onPress={() => toggleVolume(volume.id)} style={styles.volumeToggle}>
                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={18} color={colors.text} />
                    <Text style={styles.volumeToggleText}>
                      {volumeChapters.length} 章
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setDeletingVolumeId(volume.id)} style={styles.volumeDeleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>

                {isExpanded ? (
                  <View style={styles.list}>
                    {volumeChapters.map((chapter) => (
                      <FileRow
                        key={chapter.id}
                        title={chapter.title}
                        subtitle={`${chapter.content.length} 字`}
                        active={chapter.id === selected.chapter?.id}
                        onPress={() => app.selectChapter(chapter.id)}
                        icon={<Ionicons name="document-text-outline" size={22} color={colors.accent} />}
                      />
                    ))}
                    {volumeChapters.length === 0 ? (
                      <Text style={styles.emptyHint}>暂无章节</Text>
                    ) : null}
                  </View>
                ) : null}
              </Section>
            );
          })}

          <Section title="添加章节">
            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>目标卷：</Text>
              {selected.volumes.map((vol) => (
                <Pressable
                  key={vol.id}
                  onPress={() => setTargetVolumeId(vol.id)}
                  style={[
                    styles.pickerChip,
                    targetVolumeId === vol.id && styles.pickerChipActive,
                    { borderColor: targetVolumeId === vol.id ? colors.primary : colors.border }
                  ]}
                >
                  <Text style={[styles.pickerChipText, targetVolumeId === vol.id && { color: colors.primary }]}>
                    {vol.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Row>
              <Field
                label="章节标题"
                value={newChapterTitle}
                onChangeText={setNewChapterTitle}
                placeholder={`第 ${selected.chapters.length + 1} 章`}
                accessibilityLabel="章节标题"
                style={styles.inlineField}
              />
              <Button title="添加章节" onPress={createNewChapter} variant="secondary" disabled={!newChapterTitle.trim() || !targetVolumeId} />
            </Row>
          </Section>

          {selected.chapter ? (
            <Section title="编辑章节">
              <Field
                label="章节标题"
                value={selected.chapter.title}
                onChangeText={(value) => app.setChapterTitle(selected.chapter!.id, value)}
                accessibilityLabel="编辑章节标题"
              />
              <Field
                label="正文"
                multiline
                value={selected.chapter.content}
                onChangeText={(value) => app.setChapterContent(selected.chapter!.id, value)}
                onSelectionChange={(event) => app.setChapterSelection(selected.chapter!.id, event.nativeEvent.selection)}
                placeholder="从这里编辑正文。选中文本后，可在 AI 对话里替换或续写。"
                accessibilityLabel="章节正文"
                style={styles.editor}
              />
            </Section>
          ) : null}
        </>
      ) : null}

      {view === "materials" && selected.book ? (
        <>
          <Section title="资料文件夹">
            <View style={styles.list}>
              {selected.materials.map((material) => (
                <FileRow
                  key={material.id}
                  title={material.title}
                  subtitle={material.content ? `${material.content.length} 字` : "暂无内容"}
                  active={material.id === selected.material?.id}
                  onPress={() => app.selectMaterial(material.id)}
                  icon={<Ionicons name="reader-outline" size={22} color={colors.accent} />}
                />
              ))}
            </View>
          </Section>

          {selected.material ? (
            <Section title="编辑资料">
              <Field
                label={selected.material.title}
                multiline
                value={selected.material.content}
                onChangeText={(value) => app.setMaterialContent(selected.material!.id, value)}
                placeholder="记录设定、关系或章节摘要。"
                accessibilityLabel={selected.material.title}
                style={styles.editor}
              />
            </Section>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        visible={!!deletingBookId}
        title="删除书本"
        message={`确定要删除《${deletingBook?.title ?? ""}》吗？所有章节和资料将一并删除，此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteBook}
        onCancel={() => setDeletingBookId(null)}
      />

      <ConfirmDialog
        visible={!!deletingVolumeId}
        title="删除卷"
        message={`确定要删除《${deletingVolume?.title ?? ""}》吗？该卷下所有章节将一并删除，此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteVolume}
        onCancel={() => setDeletingVolumeId(null)}
      />
    </Screen>
  );
}

function BookCover({
  active,
  book,
  chapters,
  volumes,
  onPress
}: {
  active: boolean;
  book: Book;
  chapters: ChapterFile[];
  volumes: Volume[];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const coverColor = bookColor(book);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开书本 ${book.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.coverCard, active && styles.coverCardActive, pressed && styles.coverCardPressed]}
    >
      <View style={[styles.coverBlock, { backgroundColor: coverColor }]}>
        <View style={styles.coverSpine} />
        <Text numberOfLines={4} style={styles.coverTitle}>
          {book.title}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.bookTitle}>
        {book.title}
      </Text>
      <Text style={styles.bookMeta}>
        {volumes.length} 卷 · {chapters.length} 章 · {countWords(chapters)} 字
      </Text>
    </Pressable>
  );
}

function countWords(chapters: ChapterFile[]): number {
  return chapters.reduce((total, chapter) => total + chapter.content.length, 0);
}

function formatStatus(status: Book["status"]): string {
  if (status === "drafting") return "写作中";
  if (status === "finished") return "已完结";
  return "草稿";
}

function isErrorNotice(message: string): boolean {
  return message.includes("失败") || message.includes("请先") || message.includes("找不到") || message.includes("不足") || message.includes("无法") || message.includes("错误");
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shelfGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.sm,
      rowGap: spacing.lg,
      justifyContent: "space-between"
    },
    coverCard: {
      width: BOOK_COVER_WIDTH,
      minHeight: 238,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 2
    },
    coverCardActive: {
      borderColor: colors.primary,
      borderWidth: 2
    },
    coverCardPressed: {
      opacity: 0.78
    },
    coverBlock: {
      height: 178,
      borderRadius: 14,
      justifyContent: "flex-end",
      overflow: "hidden",
      padding: spacing.xs
    },
    coverSpine: {
      bottom: 0,
      left: 7,
      position: "absolute",
      top: 0,
      width: 1,
      backgroundColor: "rgba(255,255,255,0.28)"
    },
    coverTitle: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
      lineHeight: 20
    },
    bookTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginTop: spacing.xs
    },
    bookMeta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2
    },
    list: {
      gap: spacing.sm
    },
    metaBox: {
      gap: spacing.sm,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.lg
    },
    metaHeader: {
      flexDirection: "row",
      gap: spacing.md
    },
    metaCover: {
      width: 56,
      height: 72,
      borderRadius: 10,
      justifyContent: "flex-end",
      overflow: "hidden",
      padding: 4
    },
    metaCoverTitle: {
      color: "#FFFFFF",
      fontSize: 8,
      fontWeight: "800",
      lineHeight: 10
    },
    metaInfo: {
      flex: 1,
      gap: 2,
      justifyContent: "center"
    },
    metaTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800"
    },
    metaText: {
      color: colors.muted,
      fontSize: 14
    },
    volumeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs
    },
    volumeToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs
    },
    volumeToggleText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "600"
    },
    volumeDeleteBtn: {
      padding: spacing.xs
    },
    statusRow: {
      gap: spacing.xs
    },
    statusLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    pickerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.sm
    },
    pickerLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      paddingTop: 6
    },
    pickerChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: colors.surface
    },
    pickerChipActive: {
      backgroundColor: colors.background
    },
    pickerChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted
    },
    editor: {
      minHeight: 300
    },
    inlineField: {
      minWidth: 190
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingVertical: spacing.xl
    }
  });
}