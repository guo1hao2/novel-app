import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { Conversation } from "../types";
import { spacing, type ThemeColors } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 360);

type HistorySidebarProps = {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onNewConversation: () => void;
  bookTitle: string;
  visible: boolean;
};

export function HistorySidebar({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
  onClose,
  onNewConversation,
  bookTitle,
  visible
}: HistorySidebarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: visible ? 0 : SIDEBAR_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 11
    }).start();
  }, [visible, translateX]);

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>历史对话</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {bookTitle}
            </Text>
          </View>
          <Pressable accessibilityLabel="关闭" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
            <Ionicons name="close-outline" size={28} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无对话历史</Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <Pressable
                key={conv.id}
                accessibilityRole="button"
                accessibilityState={{ selected: conv.id === currentConversationId }}
                onPress={() => onSelect(conv.id)}
                style={({ pressed }) => [
                  styles.convItem,
                  conv.id === currentConversationId ? styles.convItemActive : null,
                  pressed ? styles.pressed : null
                ]}
              >
                <View style={styles.convContent}>
                  <Text style={styles.convTitle} numberOfLines={1}>
                    {conv.title.trim() || "未命名对话"}
                  </Text>
                  <Text style={styles.convTime}>{formatTime(conv.updatedAt)}</Text>
                </View>
                <Pressable
                  accessibilityLabel="删除对话"
                  onPress={() => onDelete(conv.id)}
                  style={({ pressed }) => [styles.deleteButton, pressed ? styles.pressed : null]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onNewConversation}
          style={({ pressed }) => [styles.newButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.newButtonText}>+ 新建对话</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `今天 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      justifyContent: "flex-end",
      zIndex: 100
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)"
    },
    panel: {
      width: SIDEBAR_WIDTH,
      height: "100%",
      backgroundColor: colors.background,
      borderLeftColor: colors.border,
      borderLeftWidth: 1,
      flexDirection: "column"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      borderBottomColor: colors.border,
      borderBottomWidth: 1
    },
    headerText: {
      flex: 1,
      gap: spacing.xs
    },
    headerTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900"
    },
    headerSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    closeButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: 18
    },
    list: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.sm
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xxxl
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15
    },
    convItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 64,
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.md
    },
    convItemActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary
    },
    convContent: {
      flex: 1,
      gap: 4
    },
    convTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700"
    },
    convTime: {
      color: colors.muted,
      fontSize: 12
    },
    deleteButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 32,
      height: 32,
      borderRadius: 16,
      marginLeft: spacing.sm
    },
    newButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderTopColor: colors.border,
      borderTopWidth: 1
    },
    newButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "800"
    },
    pressed: {
      opacity: 0.7
    }
  });
}
