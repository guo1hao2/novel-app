import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { ThemeColors } from "../theme";

export function getTabBarStyle(colors: ThemeColors, hidden = false): BottomTabNavigationOptions["tabBarStyle"] {
  return [
    {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      minHeight: 60,
      paddingBottom: 6,
      paddingTop: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3
    },
    hidden ? { display: "none" } : null
  ];
}
