import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Button, ConfirmDialog, Field, HorizontalList, Notice, Pill, Screen, Section, TopBar } from "../../src/components/Ui";
import { getSelectedBookData, useApp } from "../../src/context/AppContext";
import { getBookManagerLayout, getCreateActionMenuItems, type BookManagerLayout, type CreateActionKey } from "../../src/features/library/bookManagerView";
import { useTheme } from "../../src/context/ThemeContext";
import { spacing, type ThemeColors } from "../../src/theme";
import type { Book, ChapterFile, MaterialFile, Volume } from "../../src/types";

type ManagerView = "bookshelf" | "book";
type BookTab = "catalog" | "related" | "manage";
type CreateDialogType = CreateActionKey | null;

const PALETTE = ["#0F8B6C", "#4A90D9", "#E67E22", "#27AE60", "#8E44AD", "#E74C3C", "#1ABC9C", "#2C3E50"];
const CHINESE_NUMBERS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
const DEFAULT_BOOK_MANAGER_LAYOUT = getBookManagerLayout({ width: 390, platform: "ios" });

function toChineseNumber(n: number): string {
  if (n >= 0 && n < CHINESE_NUMBERS.length) return CHINESE_NUMBERS[n];
  return String(n);
}

function bookColor(book: Book): string {
  let hash = 0;
  for (let i = 0; i < book.id.length; i++) hash = book.id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function NovelsScreen() {
  const app = useApp();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const layout = useMemo(() => getBookManagerLayout({ width, platform: Platform.OS }), [width]);
  const styles = useMemo(() => createStyles(colors, layout), [colors, layout]);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newVolumeTitle, setNewVolumeTitle] = useState("");
  const [targetVolumeId, setTargetVolumeId] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<ManagerView>("bookshelf");
  const [activeTab, setActiveTab] = useState<BookTab>("catalog");
  const [createActionsOpen, setCreateActionsOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<CreateDialogType>(null);
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
    if (!selected.book) return;
    const volumeId = targetVolumeId || selected.volumes[0]?.id;
    if (!volumeId) {
      setNotice("请先新建分卷。");
      return;
    }

    await app.addChapter(selected.book.id, volumeId, newChapterTitle.trim() || `第${selected.chapters.length + 1}章`);
    setNewChapterTitle("");
    setCreateDialog(null);
    setActiveTab("catalog");
    setExpandedVolumes((prev) => new Set(prev).add(volumeId));
  }

  async function createNewVolume() {
    if (!selected.book) return;
    const volumeId = await app.addVolume(selected.book.id, newVolumeTitle.trim() || `第${toChineseNumber(selected.volumes.length + 1)}卷`);
    setNewVolumeTitle("");
    setTargetVolumeId(volumeId);
    setCreateDialog(null);
    setActiveTab("catalog");
    setExpandedVolumes((prev) => new Set(prev).add(volumeId));
  }

  function openBook(bookId: string) {
    app.selectBook(bookId);
    setView("book");
    setActiveTab("catalog");
    setCreateActionsOpen(false);
  }

  function goBack() {
    setView("bookshelf");
    setCreateActionsOpen(false);
    setCreateDialog(null);
  }

  function openCreateDialog(type: CreateActionKey) {
    setCreateActionsOpen(false);
    setCreateDialog(type);
    if (type === "chapter") {
      setTargetVolumeId(targetVolumeId || selected.volumes[0]?.id || "");
      setNewChapterTitle(`第${selected.chapters.length + 1}章`);
    } else {
      setNewVolumeTitle(`第${toChineseNumber(selected.volumes.length + 1)}卷`);
    }
  }

  async function handleDeleteBook() {
    if (!deletingBookId) return;
    await app.deleteBook(deletingBookId);
    setDeletingBookId(null);
    setView("bookshelf");
  }

  async function handleDeleteVolume() {
    if (!deletingVolumeId) return;
    await app.deleteVolume(deletingVolumeId);
    setDeletingVolumeId(null);
  }

  function toggleVolume(volumeId: string) {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  }

  const floatingAction = selected.book && view === "book"
    ? (
      <CreateFloatingAction
        isOpen={createActionsOpen}
        styles={styles}
        onAction={openCreateDialog}
        onToggle={() => setCreateActionsOpen((open) => !open)}
      />
    )
    : null;

  return (
    <Screen contentMaxWidth={layout.contentMaxWidth} floatingAction={floatingAction}>
      {view === "bookshelf" ? (
        <TopBar title="书架" subtitle={`${app.library.books.length} 部作品`} />
      ) : selected.book ? (
        <BookDetailTopBar
          book={selected.book}
          onBack={goBack}
          onMore={() => setActiveTab("manage")}
          styles={styles}
        />
      ) : null}

      <Notice message={app.error} tone="error" />

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
                  styles={styles}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="library-outline" size={34} color={colors.accent} />
              <Text style={styles.emptyTitle}>暂无作品</Text>
              <Text style={styles.emptyHint}>去 AI 对话创建第一本书，之后会出现在这里。</Text>
            </View>
          )}
        </Section>
      ) : null}

      {view === "book" && selected.book ? (
        <View style={layout.detailColumns ? styles.bookDetailShell : styles.bookDetailStack}>
          <View style={layout.detailColumns ? styles.bookDetailAside : null}>
            <BookHero
              book={selected.book}
              chapters={selected.chapters}
              volumes={selected.volumes}
              onPickCover={pickCoverImage}
              styles={styles}
            />
          </View>

          <View style={layout.detailColumns ? styles.bookDetailMain : null}>
            <BookTabs activeTab={activeTab} onChange={setActiveTab} styles={styles} />

            {activeTab === "catalog" ? (
              <CatalogPanel
                chapters={selected.chapters}
                colors={colors}
                expandedVolumes={expandedVolumes}
                onDeleteVolume={setDeletingVolumeId}
                onOpenChapter={(chapterId) => {
                  app.selectChapter(chapterId);
                  router.push({ pathname: "/chapter-editor", params: { chapterId } });
                }}
                onToggleVolume={toggleVolume}
                styles={styles}
                volumes={selected.volumes}
              />
            ) : null}

            {activeTab === "related" ? (
              <RelatedPanel
                colors={colors}
                materials={selected.materials}
                onOpenMaterial={(materialId) => {
                  app.selectMaterial(materialId);
                  router.push({ pathname: "/material-editor", params: { materialId } });
                }}
                styles={styles}
              />
            ) : null}

            {activeTab === "manage" ? (
              <ManagePanel
                book={selected.book}
                colors={colors}
                onDeleteBook={() => setDeletingBookId(selected.book!.id)}
                setBookStatus={app.setBookStatus}
                setBookSummary={app.setBookSummary}
                setBookTitle={app.setBookTitle}
                styles={styles}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <CreateDialog
        colors={colors}
        createDialog={createDialog}
        newChapterTitle={newChapterTitle}
        newVolumeTitle={newVolumeTitle}
        onCancel={() => setCreateDialog(null)}
        onConfirmChapter={createNewChapter}
        onConfirmVolume={createNewVolume}
        selectedVolumes={selected.volumes}
        setNewChapterTitle={setNewChapterTitle}
        setNewVolumeTitle={setNewVolumeTitle}
        setTargetVolumeId={setTargetVolumeId}
        styles={styles}
        targetVolumeId={targetVolumeId}
      />

      <ConfirmDialog
        visible={!!deletingBookId}
        title="删除书本"
        message={`确定要删除《${deletingBook?.title ?? ""}》吗？所有章节和资料会一起删除，此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteBook}
        onCancel={() => setDeletingBookId(null)}
      />

      <ConfirmDialog
        visible={!!deletingVolumeId}
        title="删除分卷"
        message={`确定要删除《${deletingVolume?.title ?? ""}》吗？该分卷下所有章节会一起删除，此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteVolume}
        onCancel={() => setDeletingVolumeId(null)}
      />
    </Screen>
  );
}

function BookDetailTopBar({ book, onBack, onMore, styles }: { book: Book; onBack: () => void; onMore: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.referenceTopBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回书架"
        onPress={onBack}
        style={styles.referenceIconButton}
      >
        <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
      </Pressable>
      <Text numberOfLines={1} style={styles.referenceTopTitle}>{book.title}</Text>
      <View style={styles.referenceTopActions}>
        <Ionicons name="sync-outline" size={27} color="#FFFFFF" />
        <Pressable accessibilityRole="button" accessibilityLabel="更多管理" onPress={onMore} style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

async function pickCoverImage(): Promise<string | null> {
  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      return uri;
    }
  } catch {
    // silently fail
  }
  return null;
}

function BookHero({ book, chapters, volumes, onPickCover, styles }: { book: Book; chapters: ChapterFile[]; volumes: Volume[]; onPickCover: () => Promise<string | null>; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.bookHero}>
      <DefaultCover title={book.title} onPressCover={onPickCover} styles={styles} />
      <View style={styles.heroMeta}>
        <InfoLine label="作者" value="未知" styles={styles} />
        <InfoLine label="标签" value={formatStatus(book.status)} styles={styles} />
        <InfoLine label="分卷" value={`${volumes.length}卷`} styles={styles} />
        <InfoLine label="章节" value={`${chapters.length}章`} styles={styles} />
        <InfoLine label="字数" value={`${countWords(chapters)}字`} styles={styles} />
      </View>
    </View>
  );
}

function InfoLine({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}：</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BookTabs({ activeTab, onChange, styles }: { activeTab: BookTab; onChange: (tab: BookTab) => void; styles: ReturnType<typeof createStyles> }) {
  const { colors } = useTheme();
  const tabs: Array<{ key: BookTab; label: string; icon?: string }> = [
    { key: "catalog", label: "目录" },
    { key: "related", label: "相关" },
    { key: "manage", label: "管理", icon: "list-outline" }
  ];

  return (
    <View style={styles.tabsBar}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable key={tab.key} accessibilityRole="button" onPress={() => onChange(tab.key)} style={styles.tabItem}>
            {tab.icon ? (
              <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={25} color={active ? colors.success : colors.muted} />
            ) : (
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
            )}
            <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function CatalogPanel({
  chapters,
  colors,
  expandedVolumes,
  onDeleteVolume,
  onOpenChapter,
  onToggleVolume,
  styles,
  volumes
}: {
  chapters: ChapterFile[];
  colors: ThemeColors;
  expandedVolumes: Set<string>;
  onDeleteVolume: (volumeId: string) => void;
  onOpenChapter: (chapterId: string) => void;
  onToggleVolume: (volumeId: string) => void;
  styles: ReturnType<typeof createStyles>;
  volumes: Volume[];
}) {
  return (
    <View style={styles.flatPanel}>
      {volumes.map((volume) => {
        const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volume.id);
        const isExpanded = expandedVolumes.has(volume.id);
        return (
          <View key={volume.id}>
            <View style={styles.volumeRow}>
              <Pressable accessibilityRole="button" onPress={() => onToggleVolume(volume.id)} style={styles.volumeToggleButton}>
                <View style={styles.rowTitleGroup}>
                  <Ionicons name={isExpanded ? "caret-down" : "caret-forward"} size={18} color={colors.muted} />
                  <Text numberOfLines={1} style={styles.volumeTitle}>{volume.title}</Text>
                </View>
              </Pressable>
              <View style={styles.rowTrailingGroup}>
                <Text style={styles.rowTrailing}>{volumeChapters.length}章</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`删除${volume.title}`} onPress={() => onDeleteVolume(volume.id)} style={styles.rowIconButton}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {isExpanded ? volumeChapters.map((chapter) => (
              <Pressable
                key={chapter.id}
                accessibilityRole="button"
                onPress={() => onOpenChapter(chapter.id)}
                style={styles.chapterRow}
              >
                <Text numberOfLines={1} style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.rowTrailing}>{chapter.content.length}字</Text>
              </Pressable>
            )) : null}
          </View>
        );
      })}

      {chapters.length === 0 ? <Text style={styles.emptyHint}>暂无内容，点击右下角加号新建。</Text> : null}
    </View>
  );
}

function RelatedPanel({
  colors,
  materials,
  onOpenMaterial,
  styles
}: {
  colors: ThemeColors;
  materials: MaterialFile[];
  onOpenMaterial: (materialId: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.flatPanel}>
      {materials.length > 0 ? materials.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onOpenMaterial(item.id)}
          style={styles.materialRow}
        >
          <Text numberOfLines={1} style={styles.materialTitle}>{materialTitle(item, index)}</Text>
          <Text style={styles.rowTrailing}>{item.content.length}字</Text>
        </Pressable>
      )) : (
        <View style={styles.emptyState}>
          <Ionicons name="reader-outline" size={30} color={colors.accent} />
          <Text style={styles.emptyHint}>暂无相关资料。</Text>
        </View>
      )}
    </View>
  );
}

function ManagePanel({
  book,
  colors,
  onDeleteBook,
  setBookStatus,
  setBookSummary,
  setBookTitle,
  styles
}: {
  book: Book;
  colors: ThemeColors;
  onDeleteBook: () => void;
  setBookStatus: (bookId: string, status: Book["status"]) => Promise<void>;
  setBookSummary: (bookId: string, summary: string) => Promise<void>;
  setBookTitle: (bookId: string, title: string) => Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.managePanel}>
      <Field
        label="书名"
        value={book.title}
        onChangeText={(value) => setBookTitle(book.id, value)}
        accessibilityLabel="编辑书名"
      />
      <Field
        label="简介"
        multiline
        value={book.summary}
        onChangeText={(value) => setBookSummary(book.id, value)}
        accessibilityLabel="编辑书本简介"
      />
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>状态</Text>
        <HorizontalList>
          <Pill title="草稿" active={book.status === "paused"} onPress={() => setBookStatus(book.id, "paused")} />
          <Pill title="写作中" active={book.status === "drafting"} onPress={() => setBookStatus(book.id, "drafting")} />
          <Pill title="已完结" active={book.status === "finished"} onPress={() => setBookStatus(book.id, "finished")} />
        </HorizontalList>
      </View>
      <Button
        title="删除整本书"
        variant="danger"
        onPress={onDeleteBook}
      />
      <Text style={styles.manageHint}>删除后所有章节和资料会一起移除。</Text>
      <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
    </View>
  );
}

function CreateFloatingAction({
  isOpen,
  onAction,
  styles,
  onToggle
}: {
  isOpen: boolean;
  onAction: (action: CreateActionKey) => void;
  styles: ReturnType<typeof createStyles>;
  onToggle: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.fabWrap}>
      {getCreateActionMenuItems(isOpen).map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => onAction(item.key)}
          style={({ pressed }) => [styles.fabActionRow, pressed ? styles.pressed : null]}
        >
          <Text style={styles.fabActionLabel}>{item.label}</Text>
          <View style={styles.fabMini}>
            <Ionicons name={item.icon} size={25} color={colors.success} />
          </View>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOpen ? "收起新建菜单" : "展开新建菜单"}
        onPress={onToggle}
        style={({ pressed }) => [styles.fabMain, pressed ? styles.pressed : null]}
      >
        <Ionicons name={isOpen ? "close" : "add"} size={38} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function CreateDialog({
  colors,
  createDialog,
  newChapterTitle,
  newVolumeTitle,
  onCancel,
  onConfirmChapter,
  onConfirmVolume,
  selectedVolumes,
  setNewChapterTitle,
  setNewVolumeTitle,
  setTargetVolumeId,
  styles,
  targetVolumeId
}: {
  colors: ThemeColors;
  createDialog: CreateDialogType;
  newChapterTitle: string;
  newVolumeTitle: string;
  onCancel: () => void;
  onConfirmChapter: () => void;
  onConfirmVolume: () => void;
  selectedVolumes: Volume[];
  setNewChapterTitle: (value: string) => void;
  setNewVolumeTitle: (value: string) => void;
  setTargetVolumeId: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  targetVolumeId: string;
}) {
  const visible = createDialog !== null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogScrim}>
        <View style={styles.createDialog}>
          <Text style={styles.createDialogTitle}>{createDialog === "chapter" ? "新建章节" : "新建分卷"}</Text>
          {createDialog === "chapter" ? (
            <>
              <View style={styles.dialogFieldRow}>
                <Text style={styles.dialogFieldLabel}>选择分卷</Text>
                <View style={styles.dialogChipRow}>
                  {selectedVolumes.map((volume) => (
                    <Pressable
                      key={volume.id}
                      accessibilityRole="button"
                      onPress={() => setTargetVolumeId(volume.id)}
                      style={[styles.dialogChip, targetVolumeId === volume.id ? styles.dialogChipActive : null]}
                    >
                      <Text style={[styles.dialogChipText, targetVolumeId === volume.id ? { color: colors.success } : null]}>{volume.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.dialogFieldRow}>
                <Text style={styles.dialogFieldLabel}>新章节名</Text>
                <TextInput
                  accessibilityLabel="新章节名"
                  value={newChapterTitle}
                  onChangeText={setNewChapterTitle}
                  placeholder="第1章"
                  placeholderTextColor={colors.muted}
                  style={styles.dialogInput}
                />
              </View>
            </>
          ) : (
            <View style={styles.dialogSingleInput}>
              <TextInput
                accessibilityLabel="新分卷名"
                value={newVolumeTitle}
                onChangeText={setNewVolumeTitle}
                placeholder="第1卷"
                placeholderTextColor={colors.muted}
                style={styles.dialogInputLarge}
              />
            </View>
          )}
          <View style={styles.createDialogActions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.createDialogButton}>
              <Text style={styles.createDialogCancelText}>取消</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={createDialog === "chapter" ? onConfirmChapter : onConfirmVolume} style={styles.createDialogButton}>
              <Text style={styles.createDialogConfirmText}>确定</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BookCover({
  active,
  book,
  chapters,
  volumes,
  onPress,
  styles
}: {
  active: boolean;
  book: Book;
  chapters: ChapterFile[];
  volumes: Volume[];
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const coverColor = bookColor(book);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开书本 ${book.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.coverCard, active && styles.coverCardActive, pressed && styles.pressed]}
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
        {volumes.length}卷 · {chapters.length}章 · {countWords(chapters)}字
      </Text>
    </Pressable>
  );
}

function DefaultCover({ title, onPressCover, styles }: { title: string; onPressCover: () => void; styles: ReturnType<typeof createStyles> }) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPressCover} style={styles.defaultCover}>
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>新作品</Text>
      </View>
      <View style={styles.coverNamePlate}>
        <Text style={styles.coverNameText}>默认封面</Text>
      </View>
      <View style={styles.mountainRow}>
        <View style={[styles.mountain, { borderBottomColor: colors.accentSoft }]} />
        <View style={[styles.mountainSmall, { borderBottomColor: colors.accent }]} />
      </View>
      <View style={styles.coverPickerHint}>
        <Ionicons name="image-outline" size={16} color={colors.muted} />
        <Text style={styles.coverPickerText}>点击换封面</Text>
      </View>
      <Text numberOfLines={1} style={styles.hiddenCoverTitle}>{title}</Text>
    </Pressable>
  );
}

function countWords(chapters: ChapterFile[]): number {
  return chapters.reduce((total, chapter) => total + chapter.content.length, 0);
}

function formatStatus(status: Book["status"]): string {
  if (status === "drafting") return "写作中";
  if (status === "finished") return "已完结";
  return "新作品";
}

function materialTitle(material: MaterialFile, index: number): string {
  if (material.kind === "worldbuilding") return "作品设定";
  if (material.kind === "plotOutline") return "作品大纲";
  if (material.kind === "characters") return "角色设定";
  if (material.kind === "chapterSummary") return "灵感记录";
  return material.title || `资料${index + 1}`;
}

function isErrorNotice(message: string): boolean {
  return message.includes("失败") || message.includes("请先") || message.includes("找不到") || message.includes("不足") || message.includes("无法") || message.includes("错误");
}

function createStyles(colors: ThemeColors, layout: BookManagerLayout = DEFAULT_BOOK_MANAGER_LAYOUT) {
  const panelEdgeOffset = layout.detailColumns ? 0 : -spacing.lg;
  const panelTopOffset = layout.detailColumns ? 0 : -spacing.lg;
  const primaryRowFontSize = layout.detailColumns ? 17 : 26;
  const secondaryRowFontSize = layout.detailColumns ? 15 : 22;
  const panelPaddingBottom = layout.detailColumns ? spacing.lg : 132;

  return StyleSheet.create({
    shelfGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.sm,
      rowGap: spacing.lg,
      justifyContent: "space-between"
    },
    coverCard: {
      width: layout.shelfCardWidth,
      minHeight: layout.coverHeight + 54,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: spacing.sm
    },
    coverCardActive: {
      borderColor: colors.success,
      borderWidth: 2
    },
    coverBlock: {
      height: layout.coverHeight,
      borderRadius: 8,
      justifyContent: "flex-end",
      overflow: "hidden",
      padding: spacing.sm
    },
    coverSpine: {
      bottom: 0,
      left: 8,
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
      fontWeight: "600",
      marginTop: 2
    },
    referenceTopBar: {
      alignItems: "center",
      backgroundColor: colors.success,
      flexDirection: "row",
      justifyContent: "space-between",
      marginHorizontal: panelEdgeOffset,
      marginTop: panelTopOffset,
      minHeight: layout.detailColumns ? 64 : 82,
      paddingHorizontal: spacing.lg,
      paddingTop: layout.detailColumns ? 0 : spacing.md
    },
    referenceTopTitle: {
      color: "#FFFFFF",
      flex: 1,
      fontSize: 26,
      fontWeight: "500",
      textAlign: "center"
    },
    referenceTopActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "flex-end",
      minWidth: 88
    },
    referenceIconButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      minWidth: 88
    },
    moreButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44
    },
    bookDetailStack: {
      gap: spacing.lg
    },
    bookDetailShell: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.xl
    },
    bookDetailAside: {
      flexBasis: 320,
      flexShrink: 0,
      gap: spacing.lg
    },
    bookDetailMain: {
      flex: 1,
      gap: spacing.md,
      minWidth: 0
    },
    bookHero: {
      alignItems: layout.detailColumns ? "stretch" : "center",
      backgroundColor: colors.surface,
      borderColor: layout.detailColumns ? colors.border : "transparent",
      borderRadius: layout.detailColumns ? 16 : 0,
      borderWidth: layout.detailColumns ? 1 : 0,
      flexDirection: layout.detailColumns ? "column" : "row",
      gap: layout.detailColumns ? spacing.lg : spacing.xl,
      marginHorizontal: panelEdgeOffset,
      marginTop: panelTopOffset,
      paddingHorizontal: layout.detailColumns ? spacing.lg : spacing.xl,
      paddingVertical: layout.detailColumns ? spacing.lg : spacing.xl
    },
    defaultCover: {
      backgroundColor: "#F7F6F0",
      borderRadius: 7,
      alignSelf: layout.detailColumns ? "center" : "auto",
      height: layout.detailColumns ? 196 : 142,
      overflow: "hidden",
      position: "relative",
      width: layout.detailColumns ? 144 : 104
    },
    ribbon: {
      backgroundColor: colors.success,
      left: -34,
      paddingVertical: 5,
      position: "absolute",
      top: 18,
      transform: [{ rotate: "-45deg" }],
      width: 122,
      zIndex: 2
    },
    ribbonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center"
    },
    coverNamePlate: {
      alignSelf: "center",
      borderColor: colors.border,
      borderWidth: 1,
      marginTop: 22,
      paddingHorizontal: 9,
      paddingVertical: 6
    },
    coverNameText: {
      color: colors.muted,
      fontSize: 18,
      lineHeight: 26,
      textAlign: "center",
      writingDirection: "ltr"
    },
    mountainRow: {
      alignItems: "flex-end",
      bottom: 12,
      flexDirection: "row",
      gap: -14,
      left: 10,
      position: "absolute"
    },
    mountain: {
      borderBottomWidth: 34,
      borderLeftColor: "transparent",
      borderLeftWidth: 36,
      borderRightColor: "transparent",
      borderRightWidth: 36,
      height: 0,
      opacity: 0.75,
      width: 0
    },
    mountainSmall: {
      borderBottomWidth: 24,
      borderLeftColor: "transparent",
      borderLeftWidth: 26,
      borderRightColor: "transparent",
      borderRightWidth: 26,
      height: 0,
      opacity: 0.45,
      width: 0
    },
    hiddenCoverTitle: {
      bottom: 4,
      color: "transparent",
      fontSize: 1,
      position: "absolute"
    },
    coverPickerHint: {
      alignItems: "center",
      bottom: 8,
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      position: "absolute",
      right: 8,
      backgroundColor: "rgba(255,255,255,0.7)",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 3
    },
    coverPickerText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "600"
    },
    heroMeta: {
      flex: 1,
      gap: spacing.sm
    },
    infoLine: {
      alignItems: "center",
      flexDirection: "row"
    },
    infoLabel: {
      color: colors.text,
      fontSize: layout.detailColumns ? 15 : 22,
      lineHeight: layout.detailColumns ? 22 : 29
    },
    infoValue: {
      color: colors.text,
      flex: 1,
      fontSize: layout.detailColumns ? 15 : 22,
      lineHeight: layout.detailColumns ? 22 : 29
    },
    tabsBar: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-around",
      marginHorizontal: panelEdgeOffset,
      marginTop: panelTopOffset,
      minHeight: layout.detailColumns ? 58 : 82
    },
    tabItem: {
      alignItems: "center",
      flex: 1,
      gap: spacing.sm,
      minHeight: 68,
      justifyContent: "center"
    },
    tabText: {
      color: colors.muted,
      fontSize: layout.detailColumns ? 17 : 25,
      fontWeight: "500"
    },
    tabTextActive: {
      color: colors.success
    },
    tabUnderline: {
      backgroundColor: "transparent",
      borderRadius: 2,
      height: 4,
      width: 48
    },
    tabUnderlineActive: {
      backgroundColor: colors.success
    },
    flatPanel: {
      backgroundColor: colors.surface,
      borderColor: layout.detailColumns ? colors.border : "transparent",
      borderRadius: layout.detailColumns ? 16 : 0,
      borderWidth: layout.detailColumns ? 1 : 0,
      marginHorizontal: panelEdgeOffset,
      marginTop: panelTopOffset,
      overflow: "hidden",
      paddingBottom: panelPaddingBottom
    },
    volumeRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: layout.detailColumns ? 56 : 70,
      paddingHorizontal: spacing.lg
    },
    volumeToggleButton: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      minHeight: layout.detailColumns ? 56 : 70
    },
    rowTitleGroup: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.md
    },
    volumeTitle: {
      color: colors.muted,
      flex: 1,
      fontSize: primaryRowFontSize,
      fontWeight: "500"
    },
    rowTrailingGroup: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm
    },
    rowTrailing: {
      color: colors.muted,
      fontSize: secondaryRowFontSize,
      minWidth: 54,
      textAlign: "right"
    },
    rowIconButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44
    },
    chapterRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: layout.detailColumns ? 58 : 78,
      paddingLeft: spacing.xxxl,
      paddingRight: spacing.lg
    },
    chapterRowActive: {
      backgroundColor: colors.surfaceAlt
    },
    chapterTitle: {
      color: colors.text,
      flex: 1,
      fontSize: primaryRowFontSize,
      fontWeight: "500"
    },
    materialRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: layout.detailColumns ? 62 : 86,
      paddingHorizontal: spacing.xl
    },
    materialTitle: {
      color: colors.text,
      flex: 1,
      fontSize: primaryRowFontSize,
      fontWeight: "500"
    },
    managePanel: {
      backgroundColor: colors.surface,
      borderColor: layout.detailColumns ? colors.border : "transparent",
      borderRadius: layout.detailColumns ? 16 : 0,
      borderWidth: layout.detailColumns ? 1 : 0,
      gap: spacing.lg,
      marginHorizontal: panelEdgeOffset,
      marginTop: panelTopOffset,
      padding: spacing.lg,
      paddingBottom: panelPaddingBottom
    },
    manageHint: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    statusRow: {
      gap: spacing.xs
    },
    statusLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    fabWrap: {
      alignItems: "flex-end",
      alignSelf: "center",
      gap: spacing.lg,
      maxWidth: layout.contentMaxWidth,
      paddingRight: spacing.xl,
      width: "100%"
    },
    fabActionRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.lg
    },
    fabActionLabel: {
      color: colors.text,
      fontSize: 25,
      fontWeight: "500"
    },
    fabMini: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 28,
      height: 56,
      justifyContent: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      width: 56
    },
    fabMain: {
      alignItems: "center",
      backgroundColor: colors.success,
      borderRadius: 42,
      height: 84,
      justifyContent: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      width: 84
    },
    pressed: {
      opacity: 0.72
    },
    dialogScrim: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.46)",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl
    },
    createDialog: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      maxWidth: 620,
      overflow: "hidden",
      width: "100%"
    },
    createDialogTitle: {
      color: colors.text,
      fontSize: 27,
      fontWeight: "800",
      paddingTop: spacing.xl,
      textAlign: "center"
    },
    dialogFieldRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl
    },
    dialogFieldLabel: {
      color: colors.text,
      fontSize: 22,
      minWidth: 94
    },
    dialogChipRow: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    dialogChip: {
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs
    },
    dialogChipActive: {
      borderColor: colors.success,
      backgroundColor: colors.primarySoft
    },
    dialogChipText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600"
    },
    dialogInput: {
      color: colors.text,
      flex: 1,
      fontSize: 22,
      fontWeight: "700",
      minHeight: 48
    },
    dialogSingleInput: {
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl
    },
    dialogInputLarge: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "700",
      minHeight: 56,
      textAlign: "center",
      width: "100%"
    },
    createDialogActions: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      marginTop: spacing.xl
    },
    createDialogButton: {
      alignItems: "center",
      flex: 1,
      minHeight: 72,
      justifyContent: "center"
    },
    createDialogCancelText: {
      color: colors.muted,
      fontSize: 23,
      fontWeight: "700"
    },
    createDialogConfirmText: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "800"
    },
    emptyState: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xl
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 22,
      paddingVertical: spacing.lg,
      textAlign: "center"
    }
  });
}
