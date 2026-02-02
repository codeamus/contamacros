// src/presentation/components/nutrition/ProgressCard.tsx
import { GamificationService, getUserRank, type UserStats } from "@/domain/services/gamificationService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View
} from "react-native";

type ProgressCardProps = {};

export default function ProgressCard({}: ProgressCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const result = await GamificationService.getUserStats();
    if (result.ok) {
      setStats(result.data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="small" color={colors.brand} />
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  const progress = GamificationService.getLevelProgress(stats);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <MaterialCommunityIcons
            name="trophy"
            size={24}
            color={colors.brand}
          />
          <Text style={s.title}>Progreso</Text>
        </View>
      </View>

      {/* Rango y Nivel */}
      <View style={s.rankContainer}>
        <View style={s.rankBadge}>
          <Text style={s.rankEmoji}>
            {getUserRank(stats.xp_points).emoji}
          </Text>
          <Text style={s.rankText}>
            {getUserRank(stats.xp_points).name}
          </Text>
        </View>
        <View style={s.levelContainer}>
          <View style={s.levelBadge}>
            <Text style={s.levelText}>Nivel {stats.level}</Text>
          </View>
          <View style={s.xpContainer}>
            <Text style={s.xpText}>
              {stats.xp_points} XP
            </Text>
            {progress.xpRemaining > 0 && (
              <Text style={s.xpRemainingText}>
                {progress.xpRemaining} XP para nivel {stats.level + 1}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Barra de progreso */}
      <View style={s.progressBarContainer}>
        <View style={s.progressBar}>
          <View
            style={[
              s.progressBarFill,
              { width: `${progress.progress}%` },
            ]}
          />
        </View>
        <Text style={s.progressText}>
          {progress.progress.toFixed(0)}%
        </Text>
      </View>

      {/* Racha diaria */}
      <View style={s.streakContainer}>
        <MaterialCommunityIcons
          name="fire"
          size={20}
          color={stats.daily_streak > 0 ? "#FF6B35" : colors.textSecondary}
        />
        <Text style={s.streakText}>
          Racha: {stats.daily_streak} día{stats.daily_streak !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Aportes */}
      {stats.total_foods_contributed > 0 && (
        <View style={s.contributionsContainer}>
          <MaterialCommunityIcons
            name="food-apple"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={s.contributionsText}>
            {stats.total_foods_contributed} alimento
            {stats.total_foods_contributed !== 1 ? "s" : ""} aportado
            {stats.total_foods_contributed !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    rankContainer: {
      marginBottom: 16,
    },
    rankBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.brand + "15",
      borderWidth: 1,
      borderColor: colors.brand + "30",
      marginBottom: 12,
    },
    rankEmoji: {
      fontSize: 24,
    },
    rankText: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "800",
      color: colors.brand,
    },
    levelContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    levelBadge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.brand,
    },
    levelText: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "800",
      color: colors.onCta,
    },
    xpContainer: {
      flex: 1,
    },
    xpText: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    xpRemainingText: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    progressBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    progressBar: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.brand,
      borderRadius: 4,
    },
    progressText: {
      ...typography.caption,
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      minWidth: 40,
      textAlign: "right",
    },
    streakContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    streakText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    contributionsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    contributionsText: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
}
