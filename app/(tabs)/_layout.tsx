import { useLocalSearchParams } from "expo-router";
import { Tabs } from "expo-router";

import { useTheme } from "../../src/context/ThemeContext";
import { AnimatedTabBar } from "../../src/navigation/AnimatedTabBar";

export default function TabsLayout() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const routeMode = normalizeParam(params.mode);
  const hideTabBar = routeMode === "createBook" || routeMode === "continue";

  return (
    <Tabs
      tabBar={(props) => (hideTabBar ? null : <AnimatedTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "AI 对话"
        }}
      />
      <Tabs.Screen
        name="novels"
        options={{
          title: "书架"
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "设置"
        }}
      />
    </Tabs>
  );
}

function normalizeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}