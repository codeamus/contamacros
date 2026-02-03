// src/presentation/components/ui/DateHeader.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { formatDateToSpanish } from "@/presentation/utils/date";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface DateHeaderProps {
  dateStr: string;
  kicker?: string;
  showCalendar?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  rightAction?: {
    icon: React.ComponentProps<typeof Feather>["name"];
    onPress: () => void;
  };
  onDateChange?: (newDate: string) => void;
}

export default function DateHeader({
  dateStr,
  kicker = "Diario",
  showCalendar = false,
  onRefresh,
  loading = false,
  rightAction,
  onDateChange,
}: DateHeaderProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const formattedDate = formatDateToSpanish(dateStr);

  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>{kicker}</Text>
        <Text style={s.title} numberOfLines={1}>
          {formattedDate}
        </Text>
      </View>

      {onRefresh && (
        <Pressable
          style={s.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRefresh();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Feather name="refresh-cw" size={18} color={colors.textPrimary} />
          )}
        </Pressable>
      )}

      {showCalendar && (
        <Pressable
          style={s.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (onDateChange) {
              // Si hay onDateChange, asumimos que el padre maneja la navegación o lógica especial
              // Pero DateHeader suele ir directo al calendario.
              // En diary.tsx le pasamos onDateChange para interceptar.
              router.push("/(tabs)/calendar");
            } else {
              router.push("/(tabs)/calendar");
            }
          }}
        >
          <Feather name="calendar" size={18} color={colors.textPrimary} />
        </Pressable>
      )}

      {rightAction && (
        <Pressable
          style={s.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            rightAction.onPress();
          }}
        >
          <Feather
            name={rightAction.icon}
            size={18}
            color={colors.textPrimary}
          />
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    kicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    title: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 28,
      color: colors.textPrimary,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
