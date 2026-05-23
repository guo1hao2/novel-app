import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, ConfirmDialog, Field, HorizontalList, Notice, Pill, Screen, SettingsCard, SwitchRow, TopBar } from "../../src/components/Ui";
import { useApp } from "../../src/context/AppContext";
import { useTheme } from "../../src/context/ThemeContext";
import { requestChatCompletion } from "../../src/features/ai/apiClient";
import { DEEPSEEK_VENDOR_CONFIG } from "../../src/features/settings/defaultProvider";
import { MAX_TOKENS_UPPER_BOUND, normalizeMaxTokens } from "../../src/features/settings/maxTokens";
import { spacing, type ThemeColors } from "../../src/theme";
import type { ApiProvider, ApiVendor, SkillAction, TaskCategory } from "../../src/types";

const SKILL_ACTION_OPTIONS: Array<{ action: SkillAction; label: string }> = [
  { action: "appendText", label: "追加正文" },
  { action: "replaceSelection", label: "替换选区" },
  { action: "updateMaterials", label: "更新资料" },
  { action: "chatOnly", label: "仅回复" }
];

const VENDOR_OPTIONS: Array<{ vendor: ApiVendor; label: string }> = [
  { vendor: "deepseek", label: "DeepSeek" },
  { vendor: "openai", label: "OpenAI" }
];

const DEEPSEEK_MODEL_OPTIONS = [
  { key: "pro" as const, label: "Pro", model: DEEPSEEK_VENDOR_CONFIG.models.pro },
  { key: "chat" as const, label: "Chat", model: DEEPSEEK_VENDOR_CONFIG.models.chat }
];

function inferVendor(provider: ApiProvider): ApiVendor {
  if ((provider as Record<string, unknown>).vendor === "deepseek" || (provider as Record<string, unknown>).vendor === "openai") {
    return (provider as Record<string, unknown>).vendor as ApiVendor;
  }
  return provider.baseUrl.includes("deepseek") ? "deepseek" : "openai";
}

export default function SettingsScreen() {
  const app = useApp();
  const { isNightMode, toggleNightMode, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [vendor, setVendor] = useState<ApiVendor>(inferVendor(app.provider));
  const [baseUrl, setBaseUrl] = useState(app.provider.baseUrl);
  const [maxTokens, setMaxTokens] = useState(String(app.provider.maxTokens));
  const [model, setModel] = useState(app.provider.model);
  const [notice, setNotice] = useState("");
  const [skillId, setSkillId] = useState(app.library.skills[0]?.id ?? "");
  const [skillAction, setSkillAction] = useState<SkillAction>("appendText");
  const [skillName, setSkillName] = useState("");
  const [skillPrompt, setSkillPrompt] = useState("");
  const [temperature, setTemperature] = useState(String(app.provider.temperature));
  const [savingProvider, setSavingProvider] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const selectedSkill = app.library.skills.find((skill) => skill.id === skillId);
  const isErrorNotice = notice.includes("失败") || notice.includes("请") || app.error.includes("失败");

  const deepseekModelKey = vendor === "deepseek"
    ? (model === DEEPSEEK_VENDOR_CONFIG.models.pro ? "pro" : "chat")
    : "chat";

  useEffect(() => {
    setApiKeyDraft(app.apiKey);
    const inferredVendor = inferVendor(app.provider);
    setVendor(inferredVendor);
    setBaseUrl(app.provider.baseUrl);
    setModel(app.provider.model);
    setTemperature(String(app.provider.temperature));
    setMaxTokens(String(app.provider.maxTokens));
  }, [app.apiKey, app.provider]);

  useEffect(() => {
    if (!selectedSkill) return;
    setSkillName(selectedSkill.name);
    setSkillPrompt(selectedSkill.prompt);
    setSkillAction(selectedSkill.action);
  }, [selectedSkill]);

  function handleVendorChange(newVendor: ApiVendor) {
    setVendor(newVendor);
    if (newVendor === "deepseek") {
      setBaseUrl(DEEPSEEK_VENDOR_CONFIG.baseUrl);
      setModel(DEEPSEEK_VENDOR_CONFIG.models.chat);
    } else {
      if (!baseUrl.trim() || baseUrl.includes("deepseek")) {
        setBaseUrl("https://api.openai.com/v1");
      }
      setModel("gpt-4o-mini");
    }
  }

  function handleDeepSeekModelChange(key: "pro" | "chat") {
    setModel(DEEPSEEK_VENDOR_CONFIG.models[key]);
  }

  async function saveProvider() {
    setSavingProvider(true);
    setNotice("");
    try {
      const resolvedBaseUrl = vendor === "deepseek"
        ? DEEPSEEK_VENDOR_CONFIG.baseUrl
        : baseUrl.trim();
      await app.saveProviderConfig({
        ...app.provider,
        vendor,
        baseUrl: resolvedBaseUrl,
        model: model.trim(),
        temperature: Number(temperature) || 0.5,
        maxTokens: normalizeMaxTokens(Number(maxTokens) || MAX_TOKENS_UPPER_BOUND)
      });
      await app.saveApiKey(apiKeyDraft);
      setNotice("API 配置已保存，API Key 已安全保存。");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "保存 API 配置失败。");
    } finally {
      setSavingProvider(false);
    }
  }

  async function testProvider() {
    setTesting(true);
    setNotice("");
    try {
      const resolvedBaseUrl = vendor === "deepseek"
        ? DEEPSEEK_VENDOR_CONFIG.baseUrl
        : baseUrl.trim();
      await requestChatCompletion({
        provider: {
          ...app.provider,
          baseUrl: resolvedBaseUrl,
          model: model.trim(),
          temperature: Number(temperature) || 0.5,
          maxTokens: 64
        },
        apiKey: apiKeyDraft,
        messages: [{ role: "user", content: "请只回复：连接正常" }]
      });
      setNotice("测试请求已返回。");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "测试请求失败。");
    } finally {
      setTesting(false);
    }
  }

  async function saveSkill() {
    const id = skillId || `skill-${Date.now()}`;
    await app.saveSkill({
      id,
      name: skillName.trim() || "未命名 Skill",
      prompt: skillPrompt.trim(),
      action: skillAction
    });
    setSkillId(id);
    setNotice("Skill 已保存。");
  }

  function newSkill() {
    setSkillId(`skill-${Date.now()}`);
    setSkillAction("appendText");
    setSkillName("");
    setSkillPrompt("");
  }

  async function addProvider() {
    const id = `provider-${Date.now()}`;
    const newProvider: ApiProvider = {
      id,
      name: "新 Provider",
      vendor: "deepseek",
      baseUrl: DEEPSEEK_VENDOR_CONFIG.baseUrl,
      model: DEEPSEEK_VENDOR_CONFIG.models.chat,
      temperature: 0.5,
      maxTokens: MAX_TOKENS_UPPER_BOUND,
      apiKeyStorageKey: `api_key_${id}`,
      isActive: false
    };
    await app.saveProviderConfig(newProvider);
    await app.switchProvider(id);
    setNotice("新 Provider 已添加，请配置参数。");
  }

  async function handleDeleteProvider(id: string) {
    if (app.providers.length <= 1) {
      setNotice("至少需要保留一个 Provider。");
      return;
    }
    await app.deleteProvider(id);
    setNotice("Provider 已删除。");
  }

  function confirmDeleteProvider() {
    if (app.providers.length <= 1) {
      setNotice("至少需要保留一个 Provider。");
      return;
    }
    setShowDeleteDialog(true);
  }

  async function handleSwitchProvider(id: string) {
    await app.switchProvider(id);
    setNotice("已切换 Provider。");
  }

  return (
    <Screen>
      <TopBar title="设置" subtitle="模型、外观和写作 Skill" />
      <Notice message={notice || app.error} tone={isErrorNotice ? "error" : "success"} />

      <SettingsCard title="外观">
        <SwitchRow
          title="夜晚模式"
          body="切换为低亮度深色界面，AI 对话、书架和设置页会同步生效。"
          value={isNightMode}
          onValueChange={(value) => {
            void toggleNightMode(value);
          }}
        />
      </SettingsCard>

      <SettingsCard title="API 管理">
        <View style={styles.providerShell}>
          <View style={styles.providerTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerTabList}>
              {app.providers.map((p) => (
                <ProviderTab
                  key={p.id}
                  active={p.id === app.provider.id}
                  label={p.name}
                  onPress={() => void handleSwitchProvider(p.id)}
                />
              ))}
            </ScrollView>
            <View style={styles.providerActions}>
              <ProviderActionButton
                accessibilityLabel="新建 Provider"
                icon="add"
                onPress={addProvider}
              />
              <ProviderActionButton
                accessibilityLabel="删除当前 Provider"
                disabled={app.providers.length <= 1}
                icon="trash-outline"
                onPress={confirmDeleteProvider}
                tone="danger"
              />
            </View>
          </View>

          <View style={styles.providerPanel}>
            <Field
              label="Provider 名称"
              value={app.provider.name}
              onChangeText={(text) => {
                void app.saveProviderConfig({ ...app.provider, name: text });
              }}
              accessibilityLabel="Provider 名称"
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>供应商</Text>
              <HorizontalList>
                {VENDOR_OPTIONS.map((option) => (
                  <Pill
                    key={option.vendor}
                    title={option.label}
                    active={vendor === option.vendor}
                    onPress={() => handleVendorChange(option.vendor)}
                  />
                ))}
              </HorizontalList>
            </View>

            {vendor === "deepseek" ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>模型</Text>
                <HorizontalList>
                  {DEEPSEEK_MODEL_OPTIONS.map((option) => (
                    <Pill
                      key={option.key}
                      title={option.label}
                      active={deepseekModelKey === option.key}
                      onPress={() => handleDeepSeekModelChange(option.key)}
                    />
                  ))}
                </HorizontalList>
              </View>
            ) : (
              <>
                <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} accessibilityLabel="Base URL" />
                <Field label="Model" value={model} onChangeText={setModel} accessibilityLabel="模型" />
              </>
            )}

            <Field label="API Key" value={apiKeyDraft} onChangeText={setApiKeyDraft} secureTextEntry accessibilityLabel="API Key" />
            <Field label="Temperature" value={temperature} onChangeText={setTemperature} keyboardType="decimal-pad" accessibilityLabel="Temperature" />
            <Field label="Max Tokens" value={maxTokens} onChangeText={setMaxTokens} keyboardType="number-pad" accessibilityLabel="最大输出长度" helper="DeepSeek 官方最大输出：384K tokens（393216）" />
          </View>
        </View>

        <Button title="保存 API 配置" onPress={saveProvider} loading={savingProvider} disabled={savingProvider} />
        <Button title="测试连接" onPress={testProvider} variant="secondary" loading={testing} />
      </SettingsCard>

      <TaskAssignmentCard />

      <SettingsCard title="Skill 模板">
        <HorizontalList>
          {app.library.skills.map((skill) => (
            <Pill key={skill.id} title={skill.name} active={skill.id === skillId} onPress={() => setSkillId(skill.id)} />
          ))}
          <Pill title="新建" active={false} onPress={newSkill} />
        </HorizontalList>
        <Field label="Skill 名称" value={skillName} onChangeText={setSkillName} accessibilityLabel="Skill 名称" />
        <View style={styles.skillActionGroup}>
          <Text style={styles.skillActionLabel}>确认动作</Text>
          <HorizontalList>
            {SKILL_ACTION_OPTIONS.map((option) => (
              <Pill
                key={option.action}
                title={option.label}
                active={skillAction === option.action}
                onPress={() => setSkillAction(option.action)}
              />
            ))}
          </HorizontalList>
        </View>
        <Field label="Skill 提示词" multiline value={skillPrompt} onChangeText={setSkillPrompt} accessibilityLabel="Skill 提示词" />
        <Button title="保存 Skill" onPress={saveSkill} disabled={!skillPrompt.trim()} />
      </SettingsCard>
      <ConfirmDialog
        visible={showDeleteDialog}
        title="删除 Provider"
        message={`确定删除「${app.provider.name}」吗？此操作不会删除其他 Provider。`}
        confirmText="删除"
        onConfirm={() => { void handleDeleteProvider(app.provider.id); setShowDeleteDialog(false); }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </Screen>
  );
}

function ProviderTab({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.providerTab, active ? styles.providerTabActive : null, pressed ? styles.pressed : null]}
    >
      <Text numberOfLines={1} style={[styles.providerTabText, active ? styles.providerTabTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProviderActionButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress,
  tone = "default"
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconColor = tone === "danger" ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.providerAction, pressed ? styles.pressed : null, disabled ? styles.disabledAction : null]}
    >
      <Ionicons name={icon} size={19} color={disabled ? colors.muted : iconColor} />
    </Pressable>
  );
}

const TASK_CATEGORY_OPTIONS: Array<{ category: TaskCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { category: "planning", label: "规划", icon: "compass-outline" },
  { category: "writing", label: "写作", icon: "create-outline" },
  { category: "drawing", label: "绘图", icon: "image-outline" }
];

function TaskAssignmentCard() {
  const app = useApp();
  const { colors } = useTheme();
  const taskStyles = useMemo(() => createTaskStyles(colors), [colors]);
  const [pickerCategory, setPickerCategory] = useState<TaskCategory | null>(null);

  function getAssignedProvider(category: TaskCategory): ApiProvider | undefined {
    const id = app.taskAssignments.find((a) => a.category === category)?.providerId;
    return app.providers.find((p) => p.id === id);
  }

  async function handleSelectProvider(providerId: string) {
    if (!pickerCategory) return;
    await app.saveTaskAssignment({
      id: `task-${pickerCategory}`,
      category: pickerCategory,
      providerId,
      updatedAt: new Date().toISOString()
    });
    setPickerCategory(null);
  }

  return (
    <SettingsCard title="任务分配">
      <Text style={taskStyles.description}>为不同任务类型指定使用的模型 Provider。</Text>
      <View style={taskStyles.categoryList}>
        {TASK_CATEGORY_OPTIONS.map(({ category, label, icon }) => {
          const assigned = getAssignedProvider(category);
          return (
            <View key={category} style={taskStyles.categorySlot}>
              <View style={taskStyles.categoryHeader}>
                <Ionicons name={icon} size={18} color={colors.primary} />
                <Text style={taskStyles.categoryLabel}>{label}</Text>
              </View>
              {assigned ? (
                <Pressable
                  style={({ pressed }) => [taskStyles.assignedCard, pressed && taskStyles.pressed]}
                  onPress={() => setPickerCategory(category)}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={taskStyles.assignedName} numberOfLines={1}>{assigned.name}</Text>
                  <Text style={taskStyles.changeHint}>更换</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [taskStyles.addCard, pressed && taskStyles.pressed]}
                  onPress={() => setPickerCategory(category)}
                >
                  <Ionicons name="add" size={24} color={colors.primary} />
                  <Text style={taskStyles.addLabel}>选择 Provider</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <Modal
        visible={pickerCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerCategory(null)}
      >
        <Pressable style={taskStyles.modalOverlay} onPress={() => setPickerCategory(null)}>
          <Pressable style={taskStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={taskStyles.modalHeader}>
              <Text style={taskStyles.modalTitle}>
                选择 Provider — {TASK_CATEGORY_OPTIONS.find((o) => o.category === pickerCategory)?.label}
              </Text>
            </View>
            <ScrollView style={taskStyles.modalScroll} keyboardShouldPersistTaps="handled">
              {app.providers.map((p) => {
                const isActive = pickerCategory
                  ? getAssignedProvider(pickerCategory)?.id === p.id
                  : false;
                return (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [
                      taskStyles.modalItem,
                      isActive && taskStyles.modalItemActive,
                      pressed && taskStyles.pressed
                    ]}
                    onPress={() => void handleSelectProvider(p.id)}
                  >
                    <Text
                      style={[taskStyles.modalItemText, isActive && taskStyles.modalItemTextActive]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
              {app.providers.length === 0 && (
                <Text style={taskStyles.emptyHint}>暂无 Provider，请先在 API 管理中添加。</Text>
              )}
            </ScrollView>
            <Pressable
              style={({ pressed }) => [taskStyles.modalCloseBtn, pressed && taskStyles.pressed]}
              onPress={() => setPickerCategory(null)}
            >
              <Text style={taskStyles.modalCloseText}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SettingsCard>
  );
}

function createTaskStyles(colors: ThemeColors) {
  return StyleSheet.create({
    description: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18
    },
    categoryList: {
      gap: spacing.lg
    },
    categorySlot: {
      gap: spacing.sm
    },
    categoryHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm
    },
    categoryLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700"
    },
    addCard: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 14,
      borderStyle: "dashed",
      borderWidth: 1.5,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      paddingVertical: spacing.md
    },
    addLabel: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600"
    },
    assignedCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.primary,
      borderRadius: 14,
      borderStyle: "solid",
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md
    },
    assignedName: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "600"
    },
    changeHint: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "500"
    },
    pressed: {
      opacity: 0.7
    },
    modalOverlay: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      maxHeight: 420,
      overflow: "hidden",
      width: "100%"
    },
    modalHeader: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    modalTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700"
    },
    modalScroll: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    modalItem: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md
    },
    modalItemActive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.primary
    },
    modalItemText: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "500"
    },
    modalItemTextActive: {
      color: colors.primary,
      fontWeight: "700"
    },
    emptyHint: {
      color: colors.muted,
      fontSize: 13,
      paddingVertical: spacing.lg,
      textAlign: "center"
    },
    modalCloseBtn: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingVertical: spacing.md
    },
    modalCloseText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600"
    }
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    providerShell: {
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      backgroundColor: colors.surfaceAlt,
      overflow: "hidden"
    },
    providerTabs: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm
    },
    providerTabList: {
      alignItems: "flex-end",
      gap: spacing.xs,
      paddingRight: spacing.sm
    },
    providerTab: {
      alignItems: "center",
      borderColor: colors.border,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderWidth: 1,
      borderBottomWidth: 0,
      justifyContent: "center",
      maxWidth: 160,
      minHeight: 42,
      minWidth: 92,
      paddingHorizontal: spacing.md
    },
    providerTabActive: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      marginBottom: -1,
      minHeight: 43
    },
    providerTabText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800"
    },
    providerTabTextActive: {
      color: colors.text
    },
    providerActions: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingBottom: spacing.xs
    },
    providerAction: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40
    },
    providerPanel: {
      gap: spacing.md,
      backgroundColor: colors.surface,
      padding: spacing.md
    },
    fieldGroup: {
      gap: spacing.sm
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    skillActionGroup: {
      gap: spacing.sm
    },
    skillActionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700"
    },
    pressed: {
      opacity: 0.78
    },
    disabledAction: {
      opacity: 0.46
    }
  });
}