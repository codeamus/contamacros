// app/_layout.tsx
import {
  ThemeProvider,
  useThemeBootstrap,
} from "@/presentation/theme/ThemeProvider";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";

export default function RootLayout() {
  // Carga preferencias (theme) y deja listo el provider
  const { isReady } = useThemeBootstrap();

  if (!isReady) return null;

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
