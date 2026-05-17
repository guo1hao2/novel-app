import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { spacing, type ThemeColors } from "../theme";

type TabConfig = {
  name: string;
  title: string;
  iconFocused: keyof typeof Ionicons.glyphMap;
  iconUnfocused: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { name: "chat", title: "AI 对话", iconFocused: "chatbubbles", iconUnfocused: "chatbubbles-outline" },
  { name: "novels", title: "书架", iconFocused: "book", iconUnfocused: "book-outline" },
  { name: "settings", title: "设置", iconFocused: "settings", iconUnfocused: "settings-outline" }
];

type AnimatedTabBarProps = BottomTabBarProps;

export function AnimatedTabBar({ state, descriptors, navigation }: AnimatedTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const currentIndex = state.index;
  const tabAnims = useMemo(() => TABS.map(() => new Animated.Value(0)), []);
  const indicatorPosition = useMemo(() => new Animated.Value(0), []);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const animations = tabAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: i === currentIndex ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12
      })
    );
    animations.push(
      Animated.spring(indicatorPosition, {
        toValue: currentIndex,
        useNativeDriver: true,
        tension: 80,
        friction: 12
      })
    );
    Animated.parallel(animations).start();
  }, [currentIndex]);

  const tabWidth = barWidth > 0 ? barWidth / TABS.length : 0;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth > 0 ? tabWidth : `${100 / TABS.length}%`,
              transform: [
                {
                  translateX: indicatorPosition.interpolate({
                    inputRange: TABS.map((_, i) => i),
                    outputRange: TABS.map((_, i) => i * tabWidth)
                  })
                }
              ]
            }
          ]}
        />
        {TABS.map((tab, index) => {
          const route = state.routes[index];
          if (!route) return null;
          const { tabBarAccessibilityLabel } = descriptors[route.key]?.options ?? {};
          const anim = tabAnims[index];

          const iconScale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.12]
          });

          const labelOpacity = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1]
          });

          return (
            <Pressable
              key={tab.name}
              accessibilityLabel={tabBarAccessibilityLabel ?? tab.title}
              accessibilityRole="button"
              accessibilityState={{ selected: currentIndex === index }}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true
                });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
                <Ionicons
                  name={currentIndex === index ? tab.iconFocused : tab.iconUnfocused}
                  size={currentIndex === index ? 26 : 23}
                  color={currentIndex === index ? colors.primary : colors.muted}
                />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.label,
                  { color: currentIndex === index ? colors.primary : colors.muted, opacity: labelOpacity }
                ]}
              >
                {tab.title}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      height: 56,
      position: "relative"
    },
    indicator: {
      position: "absolute",
      top: 0,
      left: 0,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.primary
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: 4
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      height: 28
    },
    label: {
      fontSize: 11,
      fontWeight: "800"
    }
  });
}