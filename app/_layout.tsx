import "./global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AppProvider } from "../src/context/AppContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const { colors, isNightMode } = useTheme();

  return (
    <AppProvider>
      <StatusBar style={isNightMode ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AppProvider>
  );
}
