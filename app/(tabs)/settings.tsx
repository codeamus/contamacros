// app/(tabs)/settings.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  const { theme, setThemeMode } = useTheme();
  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 20,
      gap: 12,
    },
    title: theme.typography.title,
    body: theme.typography.body,
    button: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.cta,
      alignSelf: "flex-start",
    },
    buttonText: {
      ...theme.typography.subtitle,
      color: theme.colors.onCta,
    },
    row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipText: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
    },
  });

  return (
    <View style={s.container}>
      <Text style={s.title}>Ajustes</Text>
      <Text style={s.body}>Tema actual: {theme.mode}</Text>

      <View style={s.row}>
        <Pressable style={s.chip} onPress={() => setThemeMode("system")}>
          <Text style={s.chipText}>Sistema</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={() => setThemeMode("light")}>
          <Text style={s.chipText}>Light</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={() => setThemeMode("dark")}>
          <Text style={s.chipText}>Dark</Text>
        </Pressable>
      </View>

      <Pressable
        style={s.button}
        onPress={() => setThemeMode(theme.mode === "dark" ? "light" : "dark")}
      >
        <Text style={s.buttonText}>Cambiar tema</Text>
      </Pressable>
    </View>
  );
}
