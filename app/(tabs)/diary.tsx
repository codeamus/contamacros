// app/(tabs)/diary.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function DiaryScreen() {
  const { theme } = useTheme();
  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 20,
    },
    title: theme.typography.title,
    body: theme.typography.body,
  });

  return (
    <View style={s.container}>
      <Text style={s.title}>Diario</Text>
      <Text style={s.body}>Aquí irá el registro manual de comidas.</Text>
    </View>
  );
}
