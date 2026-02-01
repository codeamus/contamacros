import { useTheme } from "@/presentation/theme/ThemeProvider";
import { formatDateToSpanish } from "@/presentation/utils/date";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

type HomeHeaderProps = {
  day: string;
  loading?: boolean;
};

export function HomeHeader({ day, loading = false }: HomeHeaderProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 2,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          Diario
        </Text>
        <Text
          style={{
            fontFamily: typography.title?.fontFamily,
            fontSize: 28,
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {formatDateToSpanish(day)}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          {
            width: 40,
            height: 40,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          },
          pressed && { opacity: 0.8 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(tabs)/calendar");
        }}
        disabled={loading}
      >
        <Feather name="calendar" size={18} color={colors.textPrimary} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          {
            width: 40,
            height: 40,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          },
          pressed && { opacity: 0.8 },
        ]}
        onPress={() => router.push("/(tabs)/settings")}
      >
        <Feather name="settings" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}
