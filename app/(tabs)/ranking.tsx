// app/(tabs)/ranking.tsx
import { GamificationService, type LeaderboardEntry } from "@/domain/services/gamificationService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RankingScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const result = await GamificationService.getLeaderboard(10);
    if (result.ok) {
      setLeaderboard(result.data);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }, [loadLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "trophy";
    if (rank === 2) return "trophy-outline";
    if (rank === 3) return "medal";
    return "numeric-" + rank + "-circle";
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#C0C0C0"; // Silver
    if (rank === 3) return "#CD7F32"; // Bronze
    return colors.textSecondary;
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <MaterialCommunityIcons
            name="podium"
            size={32}
            color={colors.brand}
          />
          <Text style={s.title}>Ranking de la Comunidad</Text>
          <Text style={s.subtitle}>
            Los 10 usuarios con más XP
          </Text>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={s.loadingText}>Cargando ranking...</Text>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialCommunityIcons
              name="podium-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={s.emptyText}>Aún no hay usuarios en el ranking</Text>
          </View>
        ) : (
          <View style={s.listContainer}>
            {leaderboard.map((entry, index) => (
              <View
                key={entry.user_id}
                style={[
                  s.entryCard,
                  entry.rank <= 3 && s.entryCardTop,
                ]}
              >
                {/* Rank */}
                <View style={s.rankContainer}>
                  <MaterialCommunityIcons
                    name={getRankIcon(entry.rank) as any}
                    size={28}
                    color={getRankColor(entry.rank)}
                  />
                  <Text style={[s.rankText, { color: getRankColor(entry.rank) }]}>
                    #{entry.rank}
                  </Text>
                </View>

                {/* User Info */}
                <View style={s.userInfo}>
                  <View style={s.avatar}>
                    <MaterialCommunityIcons
                      name="account-circle"
                      size={32}
                      color={colors.brand}
                    />
                  </View>
                  <View style={s.userDetails}>
                    <Text style={s.userName} numberOfLines={1}>
                      {entry.full_name || entry.email.split("@")[0] || "Usuario"}
                    </Text>
                    <Text style={s.userEmail} numberOfLines={1}>
                      {entry.email}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={s.statsContainer}>
                  <View style={s.statItem}>
                    <MaterialCommunityIcons
                      name="star"
                      size={16}
                      color={colors.brand}
                    />
                    <Text style={s.statValue}>{entry.xp_points}</Text>
                    <Text style={s.statLabel}>XP</Text>
                  </View>
                  <View style={s.statItem}>
                    <MaterialCommunityIcons
                      name="trophy"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={s.statValue}>N{entry.level}</Text>
                  </View>
                  {entry.daily_streak > 0 && (
                    <View style={s.statItem}>
                      <MaterialCommunityIcons
                        name="fire"
                        size={16}
                        color="#FF6B35"
                      />
                      <Text style={s.statValue}>{entry.daily_streak}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
    },
    header: {
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      ...typography.h1,
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    subtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    emptyText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    listContainer: {
      gap: 12,
    },
    entryCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    entryCardTop: {
      borderWidth: 2,
      borderColor: colors.brand + "40",
      backgroundColor: colors.brand + "08",
    },
    rankContainer: {
      alignItems: "center",
      minWidth: 50,
    },
    rankText: {
      ...typography.subtitle,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    userInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.brand + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      ...typography.subtitle,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    userEmail: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    statItem: {
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      ...typography.subtitle,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    statLabel: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
    },
  });
}
