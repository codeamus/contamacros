import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

type MissingTargetsNoticeProps = {
  profileOnboardingCompleted?: boolean;
};

export function MissingTargetsNotice({
  profileOnboardingCompleted = false,
}: MissingTargetsNoticeProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 14,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cta,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Feather name="account-edit" size={18} color={colors.onCta} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 14,
            color: colors.textPrimary,
          }}
        >
          Completa tu perfil
        </Text>
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          Define tu objetivo y tus macros para que el diario sea exacto.
        </Text>
      </View>

      <Pressable
        onPress={() => {
          if (!profileOnboardingCompleted) {
            router.push("/(onboarding)/goal");
          } else {
            router.push("/(tabs)/settings");
          }
        }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            height: 36,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "transparent",
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 13,
            color: colors.brand,
          }}
        >
          Configurar
        </Text>
        <Feather name="chevron-right" size={16} color={colors.brand} />
      </Pressable>
    </View>
  );
}
