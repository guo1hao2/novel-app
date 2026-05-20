import { useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../context/ThemeContext";
import { spacing, type ThemeColors } from "../theme";

export function Screen({
  children,
  footer,
  floatingAction,
  stickyHeader
}: {
  children: ReactNode;
  footer?: ReactNode;
  floatingAction?: ReactNode;
  stickyHeader?: ReactNode;
}) {
  const { styles } = useUiStyles();

  return (
    <SafeAreaView style={styles.safeArea}>
      {stickyHeader ? (
        <View style={styles.stickyHeaderShell} pointerEvents="box-none">
          {stickyHeader}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={[styles.scrollContent, stickyHeader ? styles.scrollContentWithSticky : null]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.screenFooter}>{footer}</View> : null}
      {floatingAction ? <View style={styles.floatingActionLayer} pointerEvents="box-none">{floatingAction}</View> : null}
    </SafeAreaView>
  );
}

export function TopBar({
  left,
  subtitle,
  title,
  right
}: {
  left?: ReactNode;
  subtitle?: string;
  title: string;
  right?: ReactNode;
}) {
  const { styles } = useUiStyles();

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>{left}</View>
      <View style={styles.topBarCenter}>
        <Text numberOfLines={1} style={styles.topBarTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.topBarSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.topBarSide}>{right}</View>
    </View>
  );
}

export function IconButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  const { styles } = useUiStyles();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      {icon}
    </Pressable>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { styles } = useUiStyles();

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useUiStyles();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function SettingsCard({ title, headerRight, children }: { title?: string; headerRight?: ReactNode; children: ReactNode }) {
  const { styles } = useUiStyles();

  return (
    <View style={styles.settingsCard}>
      {title ? (
        <View style={styles.settingsCardHeader}>
          <Text style={styles.settingsCardTitle}>{title}</Text>
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Field({ label, helper, ...props }: TextInputProps & { label: string; helper?: string }) {
  const { colors, styles } = useUiStyles();

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline ? styles.multiline : null, props.style]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, styles } = useUiStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : null,
        variant === "danger" ? styles.buttonDanger : null,
        pressed ? styles.pressed : null,
        disabled || loading ? styles.disabled : null
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, variant === "primary" || variant === "danger" ? styles.buttonTextPrimary : null]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function TextButton({
  title,
  onPress,
  variant = "default"
}: {
  title: string;
  onPress: () => void;
  variant?: "default" | "danger";
}) {
  const { styles } = useUiStyles();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      <Text style={[styles.textButtonText, variant === "danger" ? styles.textButtonDanger : null]}>{title}</Text>
    </Pressable>
  );
}

export function ChatBubble({ children, role }: { children: ReactNode; role: "assistant" | "user" | "system" }) {
  const { styles } = useUiStyles();
  return (
    <View style={[styles.chatBubbleRow, role === "user" ? styles.chatBubbleRowUser : null]}>
      <View
        style={[
          styles.chatBubble,
          role === "user" ? styles.chatBubbleUser : null,
          role === "system" ? styles.chatBubbleSystem : null
        ]}
      >
        {typeof children === "string" ? <Text style={[styles.chatBubbleText, role === "user" ? styles.chatBubbleTextUser : null]}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function QuickReplyBar({ options, onSelect }: { options: string[]; onSelect: (value: string) => void }) {
  const { styles } = useUiStyles();
  if (!options.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyBar}>
      {options.map((option) => (
        <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={({ pressed }) => [styles.quickReply, pressed ? styles.pressed : null]}>
          <Text style={styles.quickReplyText}>{option}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ChatComposer({
  disabled,
  leadingAccessory,
  loading,
  onChangeText,
  onSend,
  placeholder,
  value
}: {
  disabled?: boolean;
  leadingAccessory?: ReactNode;
  loading?: boolean;
  onChangeText: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  value: string;
}) {
  const { colors, styles } = useUiStyles();
  return (
    <View style={styles.composerShell}>
      {leadingAccessory ? <View style={styles.composerAccessory}>{leadingAccessory}</View> : null}
      <TextInput
        accessibilityLabel="聊天输入"
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.composerInput}
        value={value}
      />
      <Pressable
        accessibilityLabel="发送"
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        disabled={disabled || loading}
        onPress={onSend}
        style={({ pressed }) => [styles.composerSend, pressed ? styles.pressed : null, disabled || loading ? styles.disabled : null]}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.composerSendText}>发送</Text>}
      </Pressable>
    </View>
  );
}

export function Pill({ title, active, onPress }: { title: string; active?: boolean; onPress: () => void }) {
  const { styles } = useUiStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active ? styles.pillActive : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{title}</Text>
    </Pressable>
  );
}

export function SwitchRow({
  body,
  onValueChange,
  title,
  value
}: {
  body?: string;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  const { colors, styles } = useUiStyles();

  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.switchTitle}>{title}</Text>
        {body ? <Text style={styles.switchBody}>{body}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityRole="switch"
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceAlt, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : colors.muted}
      />
    </View>
  );
}

export function CardButton({
  title,
  body,
  icon,
  active,
  onPress
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  active?: boolean;
  onPress: () => void;
}) {
  const { styles } = useUiStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [styles.cardButton, active ? styles.cardButtonActive : null, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={styles.cardIcon}>{icon}</View> : null}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

export function FileRow({
  title,
  subtitle,
  icon,
  active,
  onPress
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  active?: boolean;
  onPress: () => void;
}) {
  const { styles } = useUiStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [styles.fileRow, active ? styles.fileRowActive : null, pressed ? styles.pressed : null]}
    >
      {icon ? <View style={styles.fileIcon}>{icon}</View> : null}
      <View style={styles.fileContent}>
        <Text style={styles.fileTitle}>{title}</Text>
        {subtitle ? <Text style={styles.fileSubtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  const { styles } = useUiStyles();
  return <View style={styles.row}>{children}</View>;
}

export function Notice({ message, tone = "info" }: { message: string; tone?: "info" | "error" | "success" }) {
  const { styles } = useUiStyles();
  if (!message) return null;

  return (
    <View style={[styles.notice, tone === "error" ? styles.noticeError : null, tone === "success" ? styles.noticeSuccess : null]}>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { styles } = useUiStyles();

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors, styles } = useUiStyles();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogMessage}>{message}</Text>
          <View style={styles.dialogButtons}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.dialogButton, styles.dialogButtonCancel, pressed ? styles.pressed : null]}
            >
              <Text style={styles.dialogCancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.dialogButton, styles.dialogButtonDanger, pressed ? styles.pressed : null]}
            >
              <Text style={styles.dialogDangerText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function HorizontalList({ children }: { children: ReactNode }) {
  const { styles } = useUiStyles();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
      {children}
    </ScrollView>
  );
}

function useUiStyles() {
  const { colors } = useTheme();
  return useMemo(() => ({ colors, styles: createStyles(colors) }), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
      position: "relative"
    },
    floatingActionLayer: {
      bottom: spacing.xl,
      left: 0,
      position: "absolute",
      right: 0,
      zIndex: 20
    },
    stickyHeaderShell: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4
    },
    scrollContent: {
      alignSelf: "center",
      gap: spacing.lg,
      maxWidth: 720,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      width: "100%"
    },
    scrollContentWithSticky: {
      paddingTop: 130
    },
    screenFooter: {
      alignSelf: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      backgroundColor: colors.background,
      gap: spacing.sm,
      maxWidth: 720,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
      width: "100%"
    },
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 48
    },
    topBarSide: {
      alignItems: "flex-start",
      minWidth: 44
    },
    topBarCenter: {
      alignItems: "center",
      flex: 1
    },
    topBarTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900"
    },
    topBarSubtitle: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1
    },
    header: {
      gap: spacing.sm,
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: spacing.md
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 35
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22
    },
    section: {
      gap: spacing.md,
      paddingVertical: spacing.xs
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900"
    },
    settingsCard: {
      gap: spacing.md,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 2
    },
    settingsCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    settingsCardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900"
    },
    fieldWrap: {
      gap: spacing.sm
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    helper: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18
    },
    input: {
      minHeight: 48,
      borderRadius: 16,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.input,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3
    },
    multiline: {
      minHeight: 128,
      textAlignVertical: "top"
    },
    button: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 1
    },
    buttonSecondary: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      shadowOpacity: 0.06
    },
    buttonDanger: {
      backgroundColor: colors.danger
    },
    buttonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "800"
    },
    buttonTextPrimary: {
      color: "#FFFFFF"
    },
    textButtonText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
      paddingVertical: spacing.xs,
      textAlign: "center"
    },
    textButtonDanger: {
      color: colors.danger
    },
    disabled: {
      opacity: 0.46
    },
    pressed: {
      opacity: 0.78
    },
    pill: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      borderRadius: 22,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md
    },
    pillActive: {
      backgroundColor: colors.primary
    },
    pillText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "700"
    },
    pillTextActive: {
      color: "#FFFFFF"
    },
    switchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      minHeight: 64,
      borderRadius: 16,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1
    },
    switchText: {
      flex: 1,
      gap: spacing.xs
    },
    switchTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900"
    },
    switchBody: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    notice: {
      borderRadius: 16,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.md
    },
    noticeError: {
      borderColor: colors.danger
    },
    noticeSuccess: {
      borderColor: colors.success
    },
    noticeText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20
    },
    empty: {
      gap: spacing.sm,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 1
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    emptyBody: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 22
    },
    horizontalList: {
      gap: spacing.sm,
      paddingRight: spacing.lg
    },
    cardButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 88,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 1
    },
    cardButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft
    },
    cardIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt
    },
    cardText: {
      flex: 1,
      gap: spacing.xs
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800"
    },
    cardBody: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20
    },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 64,
      borderRadius: 18,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      padding: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1
    },
    fileRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft
    },
    fileIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.accentSoft
    },
    fileContent: {
      flex: 1,
      gap: 2
    },
    fileTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800"
    },
    fileSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    chatBubbleRow: {
      alignItems: "flex-start",
      marginVertical: spacing.xs
    },
    chatBubbleRowUser: {
      alignItems: "flex-end"
    },
    chatBubble: {
      maxWidth: "86%",
      borderRadius: 20,
      borderTopLeftRadius: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    chatBubbleUser: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 8,
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    chatBubbleSystem: {
      alignSelf: "center",
      maxWidth: "96%",
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt
    },
    chatBubbleText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 23
    },
    chatBubbleTextUser: {
      color: "#FFFFFF"
    },
    quickReplyBar: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      paddingRight: spacing.lg
    },
    quickReply: {
      minHeight: 38,
      justifyContent: "center",
      borderRadius: 19,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md
    },
    quickReplyText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800"
    },
    composerShell: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: spacing.sm,
      borderRadius: 24,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surfaceGlass,
      padding: spacing.sm
    },
    composerAccessory: {
      alignItems: "center",
      height: 40,
      justifyContent: "center"
    },
    composerInput: {
      flex: 1,
      maxHeight: 120,
      minHeight: 40,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlignVertical: "top"
    },
    composerSend: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 64,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md
    },
    composerSendText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "900"
    },
    dialogOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg
    },
    dialogCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: spacing.xl,
      gap: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8
    },
    dialogTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900"
    },
    dialogMessage: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22
    },
    dialogButtons: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.xs
    },
    dialogButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      borderRadius: 16,
      paddingVertical: spacing.md
    },
    dialogButtonCancel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1
    },
    dialogButtonDanger: {
      backgroundColor: colors.danger
    },
    dialogCancelText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800"
    },
    dialogDangerText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800"
    }
  });
}
