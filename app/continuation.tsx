import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { IconButton, Screen, Section, TopBar, Notice } from "../src/components/Ui";
import { useApp } from "../src/context/AppContext";
import { useTheme } from "../src/context/ThemeContext";
import { getBookManagerLayout, type BookManagerLayout } from "../src/features/library/bookManagerView";
import { spacing, type ThemeColors } from "../src/theme";

const PALETTE = ["#0F8B6C", "#4A90D9", "#E67E22", "#27AE60", "#8E44AD", "#E74C3C", "#1ABC9C", "#2C3E50"];
const DEFAULT_BOOK_MANAGER_LAYOUT = getBookManagerLayout({ width: 390, platform: "ios" });

function bookColor(bookId: string): string {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) hash = bookId.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function ContinuationScreen() {
  const app = useApp();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const layout = useMemo(() => getBookManagerLayout({ width, platform: Platform.OS }), [width]);
  const styles = useMemo(() => createStyles(colors, layout), [colors, layout]);

  function selectBook(bookId: string) {
    router.push({ pathname: "/continuation-chat", params: { bookId } });
  }

  return (
    <Screen contentMaxWidth={layout.contentMaxWidth}>
      <TopBar
        title="续写"
        subtitle="选择一本书开始创作"
        left={
          <IconButton
            accessibilityLabel="返回"
            icon={<Ionicons name="chevron-back" size={22} color={colors.text} />}
            onPress={() => router.back()}
          />
        }
      />

      <Notice message={app.error} tone="error" />

      {app.library.books.length === 0 ? (
        <Section title="书架">
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>暂无作品</Text>
            <Text style={styles.emptyHint}>请先在 AI 对话中创建一本书，然后再来续写。</Text>
          </View>
        </Section>
      ) : (
        <Section title="选择书籍">
          <View style={styles.bookGrid}>
            {app.library.books.map((book) => {
              const chapters = app.library.chapters[book.id] ?? [];
              const volumes = app.library.volumes[book.id] ?? [];
              const wordCount = chapters.reduce((total, ch) => total + ch.content.length, 0);
              const coverColor = bookColor(book.id);
              return (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`续写 ${book.title}`}
                  onPress={() => selectBook(book.id)}
                  style={({ pressed }) => [styles.bookCard, pressed && styles.pressed]}
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
                    {volumes.length}卷 · {chapters.length}章 · {wordCount}字
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors, layout: BookManagerLayout = DEFAULT_BOOK_MANAGER_LAYOUT) {
  return StyleSheet.create({
    bookGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.sm,
      rowGap: spacing.lg,
      justifyContent: "space-between"
    },
    bookCard: {
      width: layout.shelfCardWidth,
      minHeight: layout.coverHeight + 50,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: spacing.sm
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
    emptyState: {
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxxl
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20
    },
    pressed: {
      opacity: 0.7
    }
  });
}
