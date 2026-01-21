// src/presentation/components/nutrition/AchievementsList.tsx
import { GamificationService, type UserAchievement } from "@/domain/services/gamificationService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const ACHIEVEMENTS_CONFIG: Record<
  string,
  { icon: string; title: string; description: string; color: string }
> = {
  first_contribution: {
    icon: "food-apple",
    title: "Primer Aporte",
    description: "Agregaste tu primer alimento a la comunidad",
    color: "#FF6B35",
  },
  community_chef: {
    icon: "chef-hat",
    title: "Chef de la Comunidad",
    description: "Has aportado 10 alimentos a la comunidad",
    color: "#FFD700",
  },
  week_streak: {
    icon: "fire",
    title: "Racha Semanal",
    description: "7 días consecutivos registrando comidas",
    color: "#FF6B35",
  },
  month_streak: {
    icon: "fire",
    title: "Racha Mensual",
    description: "30 días consecutivos registrando comidas",
    color: "#FF4500",
  },
};

export default function AchievementsList() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    setLoading(true);
    const result = await GamificationService.getUserAchievements();
    if (result.ok) {
      setAchievements(result.data);
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

  if (achievements.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.emptyText}>Aún no has desbloqueado medallas</Text>
        <Text style={s.emptySubtext}>
          ¡Registra comidas y aporta alimentos para ganar logros!
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Medallas Obtenidas</Text>
      <View style={s.list}>
        {achievements.map((achievement) => {
          const config = ACHIEVEMENTS_CONFIG[achievement.achievement_type];
          if (!config) return null;

          return (
            <View key={achievement.id} style={s.achievementCard}>
              <View
                style={[
                  s.achievementIcon,
                  { backgroundColor: config.color + "20" },
                ]}
              >
                <MaterialCommunityIcons
                  name={config.icon as any}
                  size={24}
                  color={config.color}
                />
              </View>
              <View style={s.achievementContent}>
                <Text style={s.achievementTitle}>{config.title}</Text>
                <Text style={s.achievementDescription}>
                  {config.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      gap: 12,
    },
    title: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    list: {
      gap: 10,
    },
    achievementCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    achievementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    achievementContent: {
      flex: 1,
    },
    achievementTitle: {
      ...typography.subtitle,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    achievementDescription: {
      ...typography.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
    },
    emptySubtext: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
    },
  });
}
