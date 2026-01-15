// app/(tabs)/home.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  return (
    <View style={s.container}>
      <Text style={s.title}>ContaMacros</Text>
      <Text style={s.subtitle}>Tu progreso, claro y simple</Text>
      <Text style={s.body}>
        Este es un placeholder. Aquí irá el dashboard diario.
      </Text>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 20,
      justifyContent: "center",
      gap: 10,
    },
    title: theme.typography.title,
    subtitle: theme.typography.subtitle,
    body: theme.typography.body,
  });
}
